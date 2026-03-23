package hipaa.audit_logging

# HIPAA 164.312(b) — Audit Controls
# Ensures systems record and examine activity in information systems containing PHI.

# AWS — CloudTrail must be multi-region
deny[msg] {
    resource := input.resource.aws_cloudtrail[name]
    not resource.is_multi_region_trail
    msg := {
        "msg": sprintf("CloudTrail '%s' is not configured as multi-region", [name]),
        "hipaa_ref": "164.312(b)",
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
        "hipaa_ref": "164.312(b)",
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
        "hipaa_ref": "164.312(b)",
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
        "hipaa_ref": "164.312(b)",
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
        "msg": sprintf("CloudWatch log group '%s' has retention of %d days — HIPAA requires >= 365 days", [name, resource.retention_in_days]),
        "hipaa_ref": "164.312(b)",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — CloudWatch log groups must not have zero retention (infinite is OK, but 0 means not set)
deny[msg] {
    resource := input.resource.aws_cloudwatch_log_group[name]
    not resource.retention_in_days
    msg := {
        "msg": sprintf("CloudWatch log group '%s' has no retention policy set — set to >= 365 days for HIPAA", [name]),
        "hipaa_ref": "164.312(b)",
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
        "msg": sprintf("GCP audit config '%s' exempts members from DATA_READ logging — all PHI access must be logged", [name]),
        "hipaa_ref": "164.312(b)",
        "severity": "HIGH",
        "resource": name,
    }
}
