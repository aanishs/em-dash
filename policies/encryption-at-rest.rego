package compliance.encryption_at_rest

# Encryption at Rest — ensures sensitive data stores are encrypted at rest

# AWS — RDS storage must be encrypted
deny[msg] {
    resource := input.resource.aws_db_instance[name]
    not resource.storage_encrypted
    msg := {
        "msg": sprintf("RDS instance '%s' does not have storage encryption enabled", [name]),
        "check_id": "rego-aws-rds-encryption",
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
        "check_id": "rego-aws-s3-encryption",
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
        "check_id": "rego-aws-ebs-encryption",
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
        "check_id": "rego-aws-kms-rotation",
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
        "check_id": "rego-aws-sns-encryption",
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
        "check_id": "rego-gcp-cloudsql-encryption",
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
        "check_id": "rego-gcp-gcs-encryption",
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
        "check_id": "rego-aws-sqs-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# Azure — Storage accounts must use encryption
deny[msg] {
    resource := input.resource.azurerm_storage_account[name]
    not resource.enable_https_traffic_only
    msg := {
        "msg": sprintf("Azure storage account '%s' does not enforce HTTPS-only traffic", [name]),
        "check_id": "rego-azure-storage-https",
        "severity": "HIGH",
        "resource": name,
    }
}

# Azure — Managed disks must be encrypted
deny[msg] {
    resource := input.resource.azurerm_managed_disk[name]
    not resource.disk_encryption_set_id
    resource.encryption_settings == []
    msg := {
        "msg": sprintf("Azure managed disk '%s' is not encrypted with customer-managed key", [name]),
        "check_id": "rego-azure-disk-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# Azure — Key Vault must have soft delete enabled
deny[msg] {
    resource := input.resource.azurerm_key_vault[name]
    resource.soft_delete_retention_days < 7
    msg := {
        "msg": sprintf("Azure Key Vault '%s' soft delete retention is less than 7 days", [name]),
        "check_id": "rego-azure-keyvault-softdelete",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# GCP — BigQuery datasets must use CMEK
deny[msg] {
    resource := input.resource.google_bigquery_dataset[name]
    not resource.default_encryption_configuration
    msg := {
        "msg": sprintf("BigQuery dataset '%s' does not use customer-managed encryption", [name]),
        "check_id": "rego-gcp-bigquery-encryption",
        "severity": "MEDIUM",
        "resource": name,
    }
}
