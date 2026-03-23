/**
 * Claude CLI subprocess runner for skill E2E testing.
 *
 * Spawns `claude -p` as a completely independent process,
 * pipes prompt via stdin, streams NDJSON output for real-time progress,
 * scans for compliance-specific errors.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const EMDASH_DEV_DIR = path.join(os.homedir(), '.em-dash-dev');
const HEARTBEAT_PATH = path.join(EMDASH_DEV_DIR, 'e2e-live.json');

/** Sanitize test name for use as filename */
export function sanitizeTestName(name: string): string {
  return name.replace(/^\/+/, '').replace(/\//g, '-');
}

/** Atomic write: write to .tmp then rename. Non-fatal on error. */
function atomicWriteSync(filePath: string, data: string): void {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

export interface CostEstimate {
  inputChars: number;
  outputChars: number;
  estimatedTokens: number;
  estimatedCost: number;
  turnsUsed: number;
}

export interface SkillTestResult {
  toolCalls: Array<{ tool: string; input: any; output: string }>;
  complianceErrors: string[];
  exitReason: string;
  duration: number;
  output: string;
  costEstimate: CostEstimate;
  transcript: any[];
  model: string;
  firstResponseMs: number;
  maxInterTurnMs: number;
}

const COMPLIANCE_ERROR_PATTERNS = [
  /PHI.*stored.*unencrypted/i,
  /evidence.*hash.*failed/i,
  /conftest.*policy.*error/i,
  /hipaa-review-log.*error/i,
  /hipaa-tool-detect.*error/i,
];

// --- Testable NDJSON parser ---

export interface ParsedNDJSON {
  transcript: any[];
  resultLine: any | null;
  turnCount: number;
  toolCallCount: number;
  toolCalls: Array<{ tool: string; input: any; output: string }>;
}

/**
 * Parse an array of NDJSON lines into structured transcript data.
 * Pure function — no I/O, no side effects.
 */
export function parseNDJSON(lines: string[]): ParsedNDJSON {
  const transcript: any[] = [];
  let resultLine: any = null;
  let turnCount = 0;
  let toolCallCount = 0;
  const toolCalls: ParsedNDJSON['toolCalls'] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      transcript.push(event);

      if (event.type === 'assistant') {
        turnCount++;
        const content = event.message?.content || [];
        for (const item of content) {
          if (item.type === 'tool_use') {
            toolCallCount++;
            toolCalls.push({
              tool: item.name || 'unknown',
              input: item.input || {},
              output: '',
            });
          }
        }
      }

      if (event.type === 'result') resultLine = event;
    } catch { /* skip malformed lines */ }
  }

  return { transcript, resultLine, turnCount, toolCallCount, toolCalls };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// --- Main runner ---

export async function runSkillTest(options: {
  prompt: string;
  workingDirectory: string;
  maxTurns?: number;
  allowedTools?: string[];
  timeout?: number;
  testName?: string;
  runId?: string;
  model?: string;
}): Promise<SkillTestResult> {
  const {
    prompt,
    workingDirectory,
    maxTurns = 15,
    allowedTools = ['Bash', 'Read', 'Write', 'Glob', 'Grep'],
    timeout = 120_000,
    testName,
    runId,
  } = options;
  const model = options.model ?? process.env.EVALS_MODEL ?? 'claude-sonnet-4-6';

  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  // Set up per-run log directory
  let runDir: string | null = null;
  const safeName = testName ? sanitizeTestName(testName) : null;
  if (runId) {
    try {
      runDir = path.join(EMDASH_DEV_DIR, 'e2e-runs', runId);
      fs.mkdirSync(runDir, { recursive: true });
    } catch { /* non-fatal */ }
  }

  const args = [
    '-p',
    '--model', model,
    '--output-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--max-turns', String(maxTurns),
    '--allowed-tools', ...allowedTools,
  ];

  // Write prompt to temp file outside workingDirectory
  const promptFile = path.join(os.tmpdir(), `.prompt-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(promptFile, prompt);

  const proc = Bun.spawn(['sh', '-c', `cat "${promptFile}" | claude ${args.map(a => `"${a}"`).join(' ')}`], {
    cwd: workingDirectory,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let stderr = '';
  let exitReason = 'unknown';
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeout);

  // Stream NDJSON from stdout
  const collectedLines: string[] = [];
  let liveTurnCount = 0;
  let liveToolCount = 0;
  let firstResponseMs = 0;
  let lastToolTime = 0;
  let maxInterTurnMs = 0;
  const stderrPromise = new Response(proc.stderr).text();

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        collectedLines.push(line);

        try {
          const event = JSON.parse(line);
          if (event.type === 'assistant') {
            liveTurnCount++;
            const content = event.message?.content || [];
            for (const item of content) {
              if (item.type === 'tool_use') {
                liveToolCount++;
                const now = Date.now();
                const elapsed = Math.round((now - startTime) / 1000);
                if (firstResponseMs === 0) firstResponseMs = now - startTime;
                if (lastToolTime > 0) {
                  const interTurn = now - lastToolTime;
                  if (interTurn > maxInterTurnMs) maxInterTurnMs = interTurn;
                }
                lastToolTime = now;
                const progressLine = `  [${elapsed}s] turn ${liveTurnCount} tool #${liveToolCount}: ${item.name}(${truncate(JSON.stringify(item.input || {}), 80)})\n`;
                process.stderr.write(progressLine);

                if (runDir) {
                  try { fs.appendFileSync(path.join(runDir, 'progress.log'), progressLine); } catch { /* non-fatal */ }
                }

                if (runId && testName) {
                  try {
                    const toolDesc = `${item.name}(${truncate(JSON.stringify(item.input || {}), 60)})`;
                    atomicWriteSync(HEARTBEAT_PATH, JSON.stringify({
                      runId,
                      pid: proc.pid,
                      startedAt,
                      currentTest: testName,
                      status: 'running',
                      turn: liveTurnCount,
                      toolCount: liveToolCount,
                      lastTool: toolDesc,
                      lastToolAt: new Date().toISOString(),
                      elapsedSec: elapsed,
                    }, null, 2) + '\n');
                  } catch { /* non-fatal */ }
                }
              }
            }
          }
        } catch { /* skip */ }

        if (runDir && safeName) {
          try { fs.appendFileSync(path.join(runDir, `${safeName}.ndjson`), line + '\n'); } catch { /* non-fatal */ }
        }
      }
    }
  } catch { /* stream read error */ }

  if (buf.trim()) collectedLines.push(buf);

  stderr = await stderrPromise;
  const exitCode = await proc.exited;
  clearTimeout(timeoutId);

  try { fs.unlinkSync(promptFile); } catch { /* non-fatal */ }

  if (timedOut) {
    exitReason = 'timeout';
  } else if (exitCode === 0) {
    exitReason = 'success';
  } else {
    exitReason = `exit_code_${exitCode}`;
  }

  const duration = Date.now() - startTime;

  const parsed = parseNDJSON(collectedLines);
  const { transcript, resultLine, toolCalls } = parsed;
  const complianceErrors: string[] = [];

  // Scan for compliance-specific errors
  const allText = transcript.map(e => JSON.stringify(e)).join('\n') + '\n' + stderr;
  for (const pattern of COMPLIANCE_ERROR_PATTERNS) {
    const match = allText.match(pattern);
    if (match) complianceErrors.push(match[0].slice(0, 200));
  }

  if (resultLine) {
    if (resultLine.is_error) {
      exitReason = 'error_api';
    } else if (resultLine.subtype === 'success') {
      exitReason = 'success';
    } else if (resultLine.subtype) {
      exitReason = resultLine.subtype;
    }
  }

  // Save failure transcript
  if (complianceErrors.length > 0 || exitReason !== 'success') {
    try {
      const failureDir = runDir || path.join(workingDirectory, '.em-dash', 'test-transcripts');
      fs.mkdirSync(failureDir, { recursive: true });
      const failureName = safeName
        ? `${safeName}-failure.json`
        : `e2e-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(
        path.join(failureDir, failureName),
        JSON.stringify({
          prompt: prompt.slice(0, 500),
          testName: testName || 'unknown',
          exitReason,
          complianceErrors,
          duration,
          turnAtTimeout: timedOut ? liveTurnCount : undefined,
          lastToolCall: liveToolCount > 0 ? `tool #${liveToolCount}` : undefined,
          stderr: stderr.slice(0, 2000),
          result: resultLine ? { type: resultLine.type, subtype: resultLine.subtype, result: resultLine.result?.slice?.(0, 500) } : null,
        }, null, 2),
      );
    } catch { /* non-fatal */ }
  }

  const turnsUsed = resultLine?.num_turns || 0;
  const estimatedCost = resultLine?.total_cost_usd || 0;
  const inputChars = prompt.length;
  const outputChars = (resultLine?.result || '').length;
  const estimatedTokens = (resultLine?.usage?.input_tokens || 0)
    + (resultLine?.usage?.output_tokens || 0)
    + (resultLine?.usage?.cache_read_input_tokens || 0);

  const costEstimate: CostEstimate = {
    inputChars,
    outputChars,
    estimatedTokens,
    estimatedCost: Math.round((estimatedCost) * 100) / 100,
    turnsUsed,
  };

  return { toolCalls, complianceErrors, exitReason, duration, output: resultLine?.result || '', costEstimate, transcript, model, firstResponseMs, maxInterTurnMs };
}
