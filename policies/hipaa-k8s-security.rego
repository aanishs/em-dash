package hipaa.k8s_security

# HIPAA 164.312(a)(1) — Access Control for Kubernetes
# Ensures Kubernetes workloads handling PHI are properly secured.

# Pods must not run as root
deny[msg] {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    container.securityContext.runAsUser == 0
    msg := {
        "msg": sprintf("Container '%s' in Deployment runs as root (UID 0)", [container.name]),
        "hipaa_ref": "164.312(a)(1)",
        "severity": "HIGH",
        "resource": input.metadata.name,
    }
}

# Pods must not run as root (runAsNonRoot not set)
deny[msg] {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    not container.securityContext.runAsNonRoot
    not container.securityContext.runAsUser
    msg := {
        "msg": sprintf("Container '%s' in Deployment does not set runAsNonRoot — may run as root", [container.name]),
        "hipaa_ref": "164.312(a)(1)",
        "severity": "MEDIUM",
        "resource": input.metadata.name,
    }
}

# Containers must not use privileged mode
deny[msg] {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    container.securityContext.privileged == true
    msg := {
        "msg": sprintf("Container '%s' in Deployment runs in privileged mode", [container.name]),
        "hipaa_ref": "164.312(a)(1)",
        "severity": "CRITICAL",
        "resource": input.metadata.name,
    }
}

# Network policies must exist in PHI namespaces
deny[msg] {
    input.kind == "Namespace"
    phi_labels := {"contains-phi", "hipaa", "phi"}
    input.metadata.labels[key] == "true"
    phi_labels[key]
    msg := {
        "msg": sprintf("Namespace '%s' is labeled for PHI but should have NetworkPolicy resources applied", [input.metadata.name]),
        "hipaa_ref": "164.312(e)(1)",
        "severity": "HIGH",
        "resource": input.metadata.name,
    }
}

# ClusterRole with wildcard verbs and resources is denied
deny[msg] {
    input.kind == "ClusterRole"
    rule := input.rules[_]
    rule.verbs[_] == "*"
    rule.resources[_] == "*"
    msg := {
        "msg": sprintf("ClusterRole '%s' grants wildcard verbs and resources — violates least privilege", [input.metadata.name]),
        "hipaa_ref": "164.312(a)(1)",
        "severity": "HIGH",
        "resource": input.metadata.name,
    }
}

# Images must come from approved registries
deny[msg] {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    not approved_registry(container.image)
    msg := {
        "msg": sprintf("Container '%s' uses image '%s' from unapproved registry", [container.name, container.image]),
        "hipaa_ref": "164.312(a)(1)",
        "severity": "MEDIUM",
        "resource": input.metadata.name,
    }
}

approved_registry(image) {
    approved := {"gcr.io/", "us-docker.pkg.dev/", "docker.io/library/", "ghcr.io/", "public.ecr.aws/", ".dkr.ecr."}
    prefix := approved[_]
    startswith(image, prefix)
}

approved_registry(image) {
    contains(image, ".dkr.ecr.")
}

# Secrets must use secretKeyRef — not inline env values with secret-like names
deny[msg] {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    env := container.env[_]
    secret_names := {"PASSWORD", "SECRET", "API_KEY", "PRIVATE_KEY", "ACCESS_KEY", "TOKEN"}
    contains(upper(env.name), secret_names[_])
    env.value
    not env.valueFrom
    msg := {
        "msg": sprintf("Container '%s' has env var '%s' with inline value — use secretKeyRef instead", [container.name, env.name]),
        "hipaa_ref": "164.312(a)(1)",
        "severity": "HIGH",
        "resource": input.metadata.name,
    }
}

# StatefulSet support — same root check
deny[msg] {
    input.kind == "StatefulSet"
    container := input.spec.template.spec.containers[_]
    container.securityContext.privileged == true
    msg := {
        "msg": sprintf("Container '%s' in StatefulSet runs in privileged mode", [container.name]),
        "hipaa_ref": "164.312(a)(1)",
        "severity": "CRITICAL",
        "resource": input.metadata.name,
    }
}
