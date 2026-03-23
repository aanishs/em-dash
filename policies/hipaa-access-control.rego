package hipaa.access_control

# HIPAA 164.312(a)(1) — Access Control
# Ensures only authorized users can access PHI.

# AWS — IAM policies must not grant Action:* with Resource:*
deny[msg] {
    resource := input.resource.aws_iam_policy[name]
    statement := json.unmarshal(resource.policy).Statement[_]
    statement.Effect == "Allow"
    statement.Action == "*"
    statement.Resource == "*"
    msg := {
        "msg": sprintf("IAM policy '%s' grants wildcard Action and Resource — violates least privilege", [name]),
        "hipaa_ref": "164.312(a)(1)",
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
        "hipaa_ref": "164.312(a)(1)",
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
        "hipaa_ref": "164.312(a)(1)",
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
        "hipaa_ref": "164.312(d)",
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
        "hipaa_ref": "164.312(a)(1)",
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
        "hipaa_ref": "164.312(a)(1)",
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
        "hipaa_ref": "164.312(a)(1)",
        "severity": "MEDIUM",
        "resource": name,
    }
}
