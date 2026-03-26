package compliance.audit_logging

# Audit Logging — ensures systems record and examine activity in information systems containing sensitive data

# AWS — CloudTrail must be multi-region
deny[msg] {
    resource := input.resource.aws_cloudtrail[name]
    not resource.is_multi_region_trail
    msg := {
        "msg": sprintf("CloudTrail '%s' is not configured as multi-region", [name]),
        "check_id": "rego-aws-cloudtrail-multiregion",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — CloudTrail must have log file validation enabled
deny[msg] {
    resource := input.resource.aws_cloudtrail[name]
    not resource.enable_log_file_validation
    msg := {
        "msg": sprintf("CloudTrail '%s' does not have log file validation enabled — logs may be tampered", [name]),
        "check_id": "rego-aws-cloudtrail-logvalidation",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — CloudTrail should be KMS-encrypted
deny[msg] {
    resource := input.resource.aws_cloudtrail[name]
    not resource.kms_key_id
    msg := {
        "msg": sprintf("CloudTrail '%s' is not encrypted with KMS — audit logs should be encrypted at rest", [name]),
        "check_id": "rego-aws-cloudtrail-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — VPC flow logs must exist for each VPC
deny[msg] {
    resource := input.resource.aws_vpc[name]
    not flow_log_exists(name)
    msg := {
        "msg": sprintf("VPC '%s' does not have flow logs enabled — network activity is not being recorded", [name]),
        "check_id": "rego-aws-vpc-flowlogs",
        "severity": "HIGH",
        "resource": name,
    }
}

flow_log_exists(vpc_name) {
    flow_log := input.resource.aws_flow_log[_]
    flow_log.vpc_id == sprintf("${aws_vpc.%s.id}", [vpc_name])
}

# AWS — CloudWatch log groups must have retention >= 365 days
deny[msg] {
    resource := input.resource.aws_cloudwatch_log_group[name]
    resource.retention_in_days < 365
    msg := {
        "msg": sprintf("CloudWatch log group '%s' has retention of %d days — compliance requires >= 365 days", [name, resource.retention_in_days]),
        "check_id": "rego-aws-cloudwatch-retention",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — CloudWatch log groups must not have zero retention (infinite is OK, but 0 means not set)
deny[msg] {
    resource := input.resource.aws_cloudwatch_log_group[name]
    not resource.retention_in_days
    msg := {
        "msg": sprintf("CloudWatch log group '%s' has no retention policy set — set to >= 365 days", [name]),
        "check_id": "rego-aws-cloudwatch-no-retention",
        "severity": "LOW",
        "resource": name,
    }
}

# GCP — Data access audit logs must be enabled
deny[msg] {
    resource := input.resource.google_project_iam_audit_config[name]
    audit_log := resource.audit_log_config[_]
    audit_log.log_type == "DATA_READ"
    count(audit_log.exempted_members) > 0
    msg := {
        "msg": sprintf("GCP audit config '%s' exempts members from DATA_READ logging — all sensitive data access must be logged", [name]),
        "check_id": "rego-gcp-audit-logging",
        "severity": "HIGH",
        "resource": name,
    }
}

# Azure — Activity log must have a log profile
deny[msg] {
    resource := input.resource.azurerm_monitor_log_profile[name]
    not resource.retention_policy
    msg := {
        "msg": sprintf("Azure log profile '%s' has no retention policy — audit logs may be lost", [name]),
        "check_id": "rego-azure-monitor-logprofile",
        "severity": "HIGH",
        "resource": name,
    }
}

# Azure — Diagnostic settings must exist for key resources
deny[msg] {
    resource := input.resource.azurerm_monitor_diagnostic_setting[name]
    resource.retention_policy.enabled == false
    msg := {
        "msg": sprintf("Azure diagnostic setting '%s' has retention disabled — audit data not preserved", [name]),
        "check_id": "rego-azure-monitor-diagnostic",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# GCP — Cloud Logging must have log sink for audit logs
deny[msg] {
    resource := input.resource.google_logging_project_sink[name]
    not resource.filter
    msg := {
        "msg": sprintf("GCP log sink '%s' has no filter — should target audit-relevant log types", [name]),
        "check_id": "rego-gcp-logging-sink",
        "severity": "LOW",
        "resource": name,
    }
}
