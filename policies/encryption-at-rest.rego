package compliance.encryption_at_rest

# Encryption at Rest — ensures sensitive data stores are encrypted at rest

# AWS — RDS storage must be encrypted
deny[msg] {
    resource := input.resource.aws_db_instance[name]
    not resource.storage_encrypted
    msg := {
        "msg": sprintf("RDS instance '%s' does not have storage encryption enabled", [name]),
        "check_id": "rego-rds-encryption",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — S3 buckets must have encryption configuration
deny[msg] {
    resource := input.resource.aws_s3_bucket[name]
    not resource.server_side_encryption_configuration
    msg := {
        "msg": sprintf("S3 bucket '%s' does not have server-side encryption configured", [name]),
        "check_id": "rego-s3-encryption",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — EBS volumes must be encrypted
deny[msg] {
    resource := input.resource.aws_ebs_volume[name]
    not resource.encrypted
    msg := {
        "msg": sprintf("EBS volume '%s' is not encrypted", [name]),
        "check_id": "rego-s3-encryption",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — KMS keys must have automatic rotation enabled
deny[msg] {
    resource := input.resource.aws_kms_key[name]
    not resource.enable_key_rotation
    msg := {
        "msg": sprintf("KMS key '%s' does not have automatic key rotation enabled", [name]),
        "check_id": "rego-kms-rotation",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — SNS topics should use KMS encryption
deny[msg] {
    resource := input.resource.aws_sns_topic[name]
    not resource.kms_master_key_id
    msg := {
        "msg": sprintf("SNS topic '%s' is not encrypted with KMS", [name]),
        "check_id": "rego-s3-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# GCP — Cloud SQL must use CMEK (customer-managed encryption key)
deny[msg] {
    resource := input.resource.google_sql_database_instance[name]
    settings := resource.settings[_]
    not settings.disk_encryption_key_name
    msg := {
        "msg": sprintf("Cloud SQL instance '%s' does not use customer-managed encryption key (CMEK)", [name]),
        "check_id": "rego-rds-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# GCP — Storage buckets must have encryption block
deny[msg] {
    resource := input.resource.google_storage_bucket[name]
    not resource.encryption
    msg := {
        "msg": sprintf("GCS bucket '%s' does not have a customer-managed encryption configuration", [name]),
        "check_id": "rego-s3-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — SQS queues should use KMS encryption
deny[msg] {
    resource := input.resource.aws_sqs_queue[name]
    not resource.kms_master_key_id
    msg := {
        "msg": sprintf("SQS queue '%s' is not encrypted with KMS", [name]),
        "check_id": "rego-s3-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}
