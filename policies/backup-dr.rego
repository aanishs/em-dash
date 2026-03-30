package compliance.backup_dr

# Backup and Disaster Recovery — ensures data backup and recovery capabilities

# AWS — RDS instances must have automated backups enabled
deny[msg] {
    resource := input.resource.aws_db_instance[name]
    resource.backup_retention_period == 0
    msg := {
        "msg": sprintf("RDS instance '%s' has automated backups disabled (retention = 0)", [name]),
        "check_id": "rego-aws-rds-backup",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — RDS backup retention must be >= 35 days
deny[msg] {
    resource := input.resource.aws_db_instance[name]
    resource.backup_retention_period > 0
    resource.backup_retention_period < 35
    msg := {
        "msg": sprintf("RDS instance '%s' backup retention is %d days — should be >= 35", [name, resource.backup_retention_period]),
        "check_id": "rego-aws-rds-backup-retention",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — S3 buckets should have versioning for data recovery
deny[msg] {
    resource := input.resource.aws_s3_bucket_versioning[name]
    resource.versioning_configuration.status != "Enabled"
    msg := {
        "msg": sprintf("S3 bucket versioning '%s' is not enabled — data cannot be recovered if overwritten", [name]),
        "check_id": "rego-aws-s3-versioning",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — DynamoDB tables should have point-in-time recovery
deny[msg] {
    resource := input.resource.aws_dynamodb_table[name]
    point_in_time := resource.point_in_time_recovery
    not point_in_time.enabled
    msg := {
        "msg": sprintf("DynamoDB table '%s' does not have point-in-time recovery enabled", [name]),
        "check_id": "rego-aws-dynamodb-backup",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# AWS — EFS file systems should have backup policy
deny[msg] {
    resource := input.resource.aws_efs_file_system[name]
    not resource.lifecycle_policy
    msg := {
        "msg": sprintf("EFS file system '%s' has no lifecycle/backup policy configured", [name]),
        "check_id": "rego-aws-efs-backup",
        "severity": "LOW",
        "resource": name,
    }
}

# GCP — Cloud SQL must have automated backups
deny[msg] {
    resource := input.resource.google_sql_database_instance[name]
    settings := resource.settings[_]
    backup := settings.backup_configuration
    not backup.enabled
    msg := {
        "msg": sprintf("Cloud SQL instance '%s' does not have automated backups enabled", [name]),
        "check_id": "rego-gcp-cloudsql-backup",
        "severity": "HIGH",
        "resource": name,
    }
}

# Azure — SQL Database must have long-term retention
deny[msg] {
    resource := input.resource.azurerm_mssql_database[name]
    not resource.long_term_retention_policy
    msg := {
        "msg": sprintf("Azure SQL Database '%s' has no long-term retention policy", [name]),
        "check_id": "rego-azure-sql-backup",
        "severity": "MEDIUM",
        "resource": name,
    }
}
