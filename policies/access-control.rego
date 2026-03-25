package compliance.access_control

# Access Control — ensures only authorized users can access sensitive data

# AWS — IAM policies must not grant Action:* with Resource:*
deny[msg] {
    resource := input.resource.aws_iam_policy[name]
    statement := json.unmarshal(resource.policy).Statement[_]
    statement.Effect == "Allow"
    statement.Action == "*"
    statement.Resource == "*"
    msg := {
        "msg": sprintf("IAM policy '%s' grants wildcard Action and Resource — violates least privilege", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — IAM policies must not use Action:* array form
deny[msg] {
    resource := input.resource.aws_iam_policy[name]
    statement := json.unmarshal(resource.policy).Statement[_]
    statement.Effect == "Allow"
    statement.Action[_] == "*"
    statement.Resource[_] == "*"
    msg := {
        "msg": sprintf("IAM policy '%s' grants wildcard Action and Resource (array form) — violates least privilege", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — IAM role inline policies must not use wildcards
deny[msg] {
    resource := input.resource.aws_iam_role_policy[name]
    statement := json.unmarshal(resource.policy).Statement[_]
    statement.Effect == "Allow"
    statement.Action == "*"
    msg := {
        "msg": sprintf("IAM role policy '%s' grants wildcard Action — violates least privilege", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — IAM users should have MFA configured (check for console access without MFA)
deny[msg] {
    resource := input.resource.aws_iam_user_login_profile[name]
    not input.resource.aws_iam_user_mfa_device[name]
    msg := {
        "msg": sprintf("IAM user '%s' has console access but no MFA device configured", [name]),
        "check_id": "rego-mfa-required",
        "severity": "HIGH",
        "resource": name,
    }
}

# GCP — Service accounts must not have roles/owner
deny[msg] {
    resource := input.resource.google_project_iam_member[name]
    contains(resource.member, "serviceAccount:")
    resource.role == "roles/owner"
    msg := {
        "msg": sprintf("GCP IAM binding '%s' grants roles/owner to a service account", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "HIGH",
        "resource": name,
    }
}

# GCP — Service accounts must not have roles/editor
deny[msg] {
    resource := input.resource.google_project_iam_member[name]
    contains(resource.member, "serviceAccount:")
    resource.role == "roles/editor"
    msg := {
        "msg": sprintf("GCP IAM binding '%s' grants roles/editor to a service account — use granular roles", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# Azure — No Contributor at subscription scope without justification
deny[msg] {
    resource := input.resource.azurerm_role_assignment[name]
    resource.role_definition_name == "Contributor"
    contains(resource.scope, "/subscriptions/")
    not contains(resource.scope, "/resourceGroups/")
    msg := {
        "msg": sprintf("Azure role assignment '%s' grants Contributor at subscription scope — scope down to resource group", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# Azure — No Owner at subscription scope
deny[msg] {
    resource := input.resource.azurerm_role_assignment[name]
    resource.role_definition_name == "Owner"
    contains(resource.scope, "/subscriptions/")
    not contains(resource.scope, "/resourceGroups/")
    msg := {
        "msg": sprintf("Azure role assignment '%s' grants Owner at subscription scope — scope down to resource group", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "HIGH",
        "resource": name,
    }
}

# GCP — Service account keys should not exist (use workload identity)
deny[msg] {
    resource := input.resource.google_service_account_key[name]
    msg := {
        "msg": sprintf("GCP service account key '%s' exists — prefer workload identity over long-lived keys", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# GCP — IAM bindings must not use allUsers or allAuthenticatedUsers
deny[msg] {
    resource := input.resource.google_project_iam_binding[name]
    public_members := {"allUsers", "allAuthenticatedUsers"}
    resource.members[_] == public_members[_]
    msg := {
        "msg": sprintf("GCP IAM binding '%s' grants access to %s — public access to project resources", [name, resource.members[_]]),
        "check_id": "rego-iam-wildcard",
        "severity": "CRITICAL",
        "resource": name,
    }
}

# Azure — Custom role definitions must not use wildcard actions
deny[msg] {
    resource := input.resource.azurerm_role_definition[name]
    permission := resource.permissions[_]
    permission.actions[_] == "*"
    msg := {
        "msg": sprintf("Azure custom role '%s' uses wildcard actions — violates least privilege", [name]),
        "check_id": "rego-iam-wildcard",
        "severity": "HIGH",
        "resource": name,
    }
}
