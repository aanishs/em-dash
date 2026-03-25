package compliance.container_security

# Container Security — Dockerfile and container image best practices

# Dockerfiles must not use USER root (or no USER directive = runs as root)
deny[msg] {
    input.kind == "Dockerfile"
    instruction := input.stages[_].instructions[_]
    instruction.cmd == "USER"
    instruction.value == "root"
    msg := {
        "msg": "Dockerfile sets USER root — containers should not run as root",
        "check_id": "rego-k8s-non-root",
        "severity": "HIGH",
        "resource": "Dockerfile",
    }
}

# Dockerfiles should not use latest tag
deny[msg] {
    input.kind == "Dockerfile"
    instruction := input.stages[_].instructions[_]
    instruction.cmd == "FROM"
    endswith(instruction.value, ":latest")
    msg := {
        "msg": sprintf("Dockerfile uses ':latest' tag in FROM '%s' — pin to a specific version", [instruction.value]),
        "check_id": "rego-k8s-non-root",
        "severity": "MEDIUM",
        "resource": "Dockerfile",
    }
}

# Dockerfiles should not use ADD for remote URLs (use COPY + curl)
deny[msg] {
    input.kind == "Dockerfile"
    instruction := input.stages[_].instructions[_]
    instruction.cmd == "ADD"
    startswith(instruction.value, "http")
    msg := {
        "msg": sprintf("Dockerfile uses ADD with URL '%s' — use COPY or RUN curl for transparency", [instruction.value]),
        "check_id": "rego-no-hardcoded-secrets",
        "severity": "MEDIUM",
        "resource": "Dockerfile",
    }
}

# Dockerfiles must not expose sensitive ports directly
deny[msg] {
    input.kind == "Dockerfile"
    instruction := input.stages[_].instructions[_]
    instruction.cmd == "EXPOSE"
    sensitive_ports := {"22", "3306", "5432", "27017", "1433"}
    instruction.value == sensitive_ports[_]
    msg := {
        "msg": sprintf("Dockerfile exposes sensitive port %s — database/SSH ports should not be exposed directly", [instruction.value]),
        "check_id": "rego-security-group-open",
        "severity": "MEDIUM",
        "resource": "Dockerfile",
    }
}

# Docker Compose — no privileged containers
deny[msg] {
    input.kind == "docker-compose"
    service := input.services[name]
    service.privileged == true
    msg := {
        "msg": sprintf("Docker Compose service '%s' runs in privileged mode", [name]),
        "check_id": "rego-k8s-non-root",
        "severity": "CRITICAL",
        "resource": name,
    }
}
