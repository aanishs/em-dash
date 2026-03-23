# em-dash design system

Design reference for the em-dash compliance dashboard. Dark-first, information-dense, zero-decoration. Built for technical founders who want to see their compliance state, not admire gradients.

## Principles

1. **Density over decoration** — every pixel earns its place. No hero sections, no illustrations, no empty states with sad cloud icons.
2. **Scannable hierarchy** — a founder should understand their compliance posture in under 3 seconds from the overview page.
3. **Progressive disclosure** — summary first, details on click. Findings expand. Checklist items reveal notes. Risk cells show details.
4. **Dark by default** — engineers live in dark mode. Light mode exists but dark is the primary design target.
5. **Keyboard-first** — sidebar shortcuts (O/!/E/R/V/A/D/C/F), no mouse required for navigation.

## Color system

```
Background:  #0a0a0a (dark) / #fafafa (light)
Surface:     #141414 (dark) / #ffffff (light)
Border:      #2a2a2a (dark) / #e5e5e5 (light)
Text:        #e5e5e5 (dark) / #1a1a1a (light)
Secondary:   #999999 (dark) / #666666 (light)
```

### Semantic colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#2563eb` / `#3b82f6` | Links, active states, primary actions, in-progress pipeline |
| `--green` | `#16a34a` / `#22c55e` | Completed states, passing checks, compliant items |
| `--red` | `#dc2626` / `#ef4444` | Critical severity, errors, expired BAAs |
| `--orange` | `#ea580c` / `#f97316` | High severity, warnings, expiring BAAs |
| `--yellow` | `#ca8a04` / `#eab308` | Medium severity, caution states |
| `--purple` | `#7c3aed` / `#8b5cf6` | Low severity |

### Severity palette

```
Critical  →  --red       (#dc2626)
High      →  --orange    (#ea580c)
Medium    →  --yellow    (#ca8a04)
Low       →  --purple    (#7c3aed)
```

Each severity has a `-light` variant for subtle backgrounds: `--red-light`, `--orange-light`, etc.

## Typography

```css
--font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
--mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
```

| Element | Size | Weight | Font |
|---------|------|--------|------|
| Page title (header) | 0.95rem | 500 | System |
| Section heading | 1.1rem | 600 | System |
| Body text | 0.875rem | 400 | System |
| Metadata / timestamps | 0.7rem | 400 | Mono |
| Badges (severity, status) | 0.65rem | 600 | Mono |
| Pipeline step name | 0.8rem | 600 | System |
| Chart labels | Inherited from Chart.js | — | Mono |

## Spacing

```
--radius: 8px
```

| Context | Value |
|---------|-------|
| Section padding | 1.5rem |
| Card internal gap | 0.75rem |
| Pipeline grid gap | 0.625rem |
| Pipeline step padding | 0.875rem 0.625rem |
| List item padding | 0.875rem 1rem |
| Badge padding | 0.15rem 0.5rem |
| Main content padding | 2rem (top/bottom), 2rem (sides) |
| Content max-width | 1280px |

## Layout

### Sidebar (200px fixed)

```
em-dash (brand)
─────────────────
O  Overview
!  Findings     [8]
✓  Checklist    [20/29]
E  Evidence
R  Risks        [6]
V  Vendors
A  Activity
─────────────────
D  Export Report
C  Export CSV
F  Open in Finder
```

- Fixed left, full viewport height
- Active item: left accent border + accent text
- Badge counts: pill-shaped, `--text-secondary` background
- Keyboard shortcuts: single character, mono font, `--text-secondary`
- Collapses to hamburger at `≤768px`

### Main content

- `margin-left: 200px` (sidebar width)
- `max-width: 1280px` with `32px` horizontal padding
- Sticky header with project name + compliance ring

## Components

### Compliance ring (header)

SVG circle with percentage text. Stroke color maps to score:
- `≥80%`: green
- `60–79%`: yellow
- `<60%`: red

### Pipeline steps (6-column grid)

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│    ✓     │ │    ✓     │ │    ○     │ │    ✓     │ │    –     │ │    –     │
│  Assess  │ │   Scan   │ │Remediate │ │  Report  │ │ Monitor  │ │  Breach  │
│  2d ago  │ │  1d ago  │ │ 19h ago  │ │ 15h ago  │ │          │ │          │
│ 8 finds  │ │ 12 finds │ │ 5 finds  │ │          │ │          │ │          │
│ summary… │ │ summary… │ │ summary… │ │ summary… │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
┌────────────────────────────────────────────────────────────────────────────┐
│ Next: Run /hipaa-remediate to fix 8 open findings (3 critical).          │
└────────────────────────────────────────────────────────────────────────────┘
```

- `grid-template-columns: repeat(6, 1fr)`
- Icons: `✓` complete (green bg), `○` in-progress (accent bg), `–` pending (border bg, dimmed)
- 36px circle icon, 50% border-radius
- Summary: 2-line clamp with ellipsis
- Next-step: spans full grid width (`grid-column: 1 / -1`), accent border + background
- Mobile (`≤768px`): collapses to `repeat(3, 1fr)`, hides summaries

### Section cards

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius);   /* 8px */
padding: 1.5rem;
overflow: hidden;
```

### Finding rows

```
[CRITICAL] Finding title                                          [Open ▾]
           §164.312(a)(1) · hipaa-scan · Mar 21, 2026
```

- Flex row: severity badge → content (flex:1) → status select (100px)
- Expandable: click title to reveal description, dates, linked evidence
- Severity badge: pill-shaped (`border-radius: 999px`), uppercase mono, semantic color

### Checklist items

- Section tabs: `All`, `Administrative Safeguards`, `Physical`, `Technical`, etc.
- Checkbox + strikethrough title on completion
- Evidence file tags (linked, clickable)
- Editable notes per item

### Risk matrix (5×5)

```
LIKELIHOOD →
     1    2    3    4    5
5  [grn][grn][ylw][org][red]
4  [grn][ylw][org][org][red]
3  [grn][ylw][ylw][org][red]
2  [grn][grn][ylw][org][org]
1  [grn][grn][grn][ylw][org]
IMPACT →
```

- `grid-template-columns: 32px repeat(5, 1fr)`
- Cells: 48px height, fluid width, `max-width: 480px`
- Color: green (1–4), yellow (5–9), orange (10–14), red (15–25)
- Numbers in cells = risk count at that intersection
- Toggle: Matrix view ↔ Table view

### Vendor rows

```
[Vendor name]                    [SIGNED] Exp. Jan 15, 2027 [critical] Edit Delete
[service · contact]
[notes]
```

- BAA badge: pill, min-width 56px, centered (`SIGNED`, `PENDING`, `NOT-REQUESTED`)
- Expiry: mono, right-aligned, min-width 110px. Warning class for <90 days, expired class for past.
- Risk tier: pill, min-width 52px, centered (`critical`, `high`, `medium`, `low`)

### Evidence library

- Search bar (full width)
- Drag-and-drop upload zone with framework/requirement/type selectors
- File rows: type badge (DOC/POL) → filename → metadata → SHA hash → actions

### Activity timeline

- Vertical timeline with colored dots
- Dot color by event type: finding (severity color), evidence (green), risk (orange), skill (accent)
- Timestamp in relative format (`14h ago`, `1d ago`)

## Charts

**Library: [Chart.js v4](https://www.chartjs.org/)** loaded via CDN (`chart.js@4/dist/chart.umd.min.js`).

Three overview charts in a `repeat(3, 1fr)` grid:

| Chart | Type | Data |
|-------|------|------|
| Requirements by Section | Horizontal bar | Compliance % per HIPAA section |
| Findings by Severity | Doughnut | Count by critical/high/medium/low |
| Evidence Coverage | Doughnut | Requirements with vs without evidence |

Chart.js config:
- Dark theme: `color: '#999'`, grid lines off or `#2a2a2a`
- Doughnut cutout: 60%
- Legend: bottom-positioned, point style
- Responsive: true, `maintainAspectRatio: false`
- Container: `height: 200px`, `min-width: 0`, `overflow: hidden`

## Responsive breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `>768px` | Full sidebar + main content |
| `≤768px` | Sidebar hidden (hamburger toggle), pipeline 3-col, summaries hidden |

## Interaction patterns

| Pattern | Behavior |
|---------|----------|
| Finding expand | Click title → toggle `hidden` on details div |
| Checklist toggle | Click checkbox → PUT to API → strikethrough |
| Evidence upload | Drag file to drop zone → POST multipart → refresh list |
| Risk view toggle | Matrix ↔ Table buttons |
| Status change | Select dropdown → PUT finding status |
| Keyboard nav | Single-key sidebar shortcuts (O, !, ✓, E, R, V, A, D, C, F) |
| Confirm dialogs | Styled modal for destructive actions (delete evidence, vendor) |
| Live reload | WebSocket connection, auto-refresh on `dashboard.json` changes |

## Export

| Format | Endpoint | Content |
|--------|----------|---------|
| HTML Report | `GET /api/export/report` | Full compliance report, styled, printable |
| CSV | `GET /api/export/csv` | Findings table export |
| Open in Finder | `POST /api/open` | Opens `.em-dash/` directory in system file manager |
