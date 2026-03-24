package compliance.secrets

# Secrets Management — ensures no hardcoded secrets in infrastructure-as-code or container definitions

# No hardcoded AWS access keys in Terraform providers
deny[msg] {
    resource := input.resource.aws_provider[name]
    resource.access_key
    msg := {
        "msg": sprintf("AWS provider '%s' has hardcoded access_key — use environment variables or IAM roles", [name]),
        "check_id": "rego-no-hardcoded-secrets",
        "severity": "CRITICAL",
        "resource": name,
    }
}

# No hardcoded AWS secret keys in Terraform providers
deny[msg] {
    resource := input.resource.aws_provider[name]
    resource.secret_key
    msg := {
        "msg": sprintf("AWS provider '%s' has hardcoded secret_key — use environment variables or IAM roles", [name]),
        "check_id": "rego-no-hardcoded-secrets",
        "severity": "CRITICAL",
        "resource": name,
    }
}

# No plaintext passwords in Terraform variable defaults
deny[msg] {
    resource := input.variable[name]
    contains(lower(name), "password")
    resource.default
    resource.default != ""
    msg := {
        "msg": sprintf("Terraform variable '%s' has a default value — password variables must not have defaults", [name]),
        "check_id": "rego-no-hardcoded-secrets",
        "severity": "HIGH",
        "resource": name,
    }
}

# No plaintext secrets in Terraform variable defaults
deny[msg] {
    resource := input.variable[name]
    secret_patterns := {"secret", "api_key", "private_key", "token", "access_key"}
    contains(lower(name), secret_patterns[_])
    resource.default
    resource.default != ""
    msg := {
        "msg": sprintf("Terraform variable '%s' has a default value — secret variables must not have defaults", [name]),
        "check_id": "rego-no-hardcoded-secrets",
        "severity": "HIGH",
        "resource": name,
    }
}

# K8s env vars named *PASSWORD/*SECRET/*KEY must use secretKeyRef
deny[msg] {
    kinds := {"Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"}
    input.kind == kinds[_]
    container := input.spec.template.spec.containers[_]
    env := container.env[_]
    secret_names := {"PASSWORD", "SECRET", "API_KEY", "PRIVATE_KEY", "ACCESS_KEY"}
    contains(upper(env.name), secret_names[_])
    env.value
    not env.valueFrom
    msg := {
        "msg": sprintf("Container '%s' env var '%s' uses inline value — must use secretKeyRef", [container.name, env.name]),
        "check_id": "rego-no-hardcoded-secrets",
        "severity": "HIGH",
        "resource": input.metadata.name,
    }
}
