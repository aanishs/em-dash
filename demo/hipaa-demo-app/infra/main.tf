# HIPAA Demo App — Infrastructure
#
# Remediated to comply with HIPAA Security Rule requirements.

provider "aws" {
  region = "us-east-1"
}

# ─── S3 Bucket: Patient Records ─────────────────────────────────

resource "aws_s3_bucket" "patient_records" {
  bucket = "hipaa-demo-patient-records"
}

resource "aws_s3_bucket_versioning" "patient_records" {
  bucket = aws_s3_bucket.patient_records.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "patient_records" {
  bucket = aws_s3_bucket.patient_records.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.app.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "patient_records" {
  bucket                  = aws_s3_bucket.patient_records.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "patient_records" {
  bucket        = aws_s3_bucket.patient_records.id
  target_bucket = aws_s3_bucket.patient_records.id
  target_prefix = "access-logs/"
}

# ─── RDS: Patient Database ──────────────────────────────────────

resource "aws_db_instance" "patients" {
  identifier     = "hipaa-demo-patients"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  username       = "admin"
  # Password sourced from Secrets Manager — never hardcode
  password = data.aws_secretsmanager_secret_version.db_password.secret_string

  storage_encrypted            = true               # Encrypt ePHI at rest
  kms_key_id                   = aws_kms_key.app.arn
  publicly_accessible          = false               # Private subnet only
  multi_az                     = true                # High availability
  deletion_protection          = true
  auto_minor_version_upgrade   = true
  backup_retention_period      = 35                  # 35-day backup retention
  skip_final_snapshot          = false
  final_snapshot_identifier    = "hipaa-demo-patients-final"
  iam_database_authentication_enabled = true
  monitoring_interval          = 60
  performance_insights_enabled = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Require SSL for all connections
  parameter_group_name = aws_db_parameter_group.patients.name
}

resource "aws_db_parameter_group" "patients" {
  name   = "hipaa-demo-patients"
  family = "postgres15"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "pgaudit.log"
    value = "all"
  }
}

data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "hipaa-demo/db-password"
  kms_key_id              = aws_kms_key.app.arn
  recovery_window_in_days = 7
}

# ─── IAM: Least-Privilege Policy ────────────────────────────────

resource "aws_iam_policy" "app_policy" {
  name = "hipaa-demo-app-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.patient_records.arn,
          "${aws_s3_bucket.patient_records.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.app.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [aws_secretsmanager_secret.db_password.arn]
      }
    ]
  })
}

# ─── Security Group: Restricted Access ──────────────────────────

resource "aws_security_group" "app" {
  name        = "hipaa-demo-app"
  description = "App security group — restricted to HTTPS and app port only"

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"] # Internal network only
  }

  ingress {
    description = "App port"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"] # Internal network only
  }

  egress {
    description = "HTTPS outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─── CloudTrail: API Audit Logging ──────────────────────────────

resource "aws_cloudtrail" "main" {
  name                       = "hipaa-demo-trail"
  s3_bucket_name             = aws_s3_bucket.patient_records.id
  s3_key_prefix              = "cloudtrail/"
  is_multi_region_trail      = true
  enable_log_file_validation = true
  kms_key_id                 = aws_kms_key.app.arn
}

# ─── VPC Flow Logs: Network Monitoring ──────────────────────────

resource "aws_flow_log" "main" {
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
  traffic_type    = "ALL"
  vpc_id          = "vpc-placeholder" # Replace with actual VPC ID
  iam_role_arn    = "arn:aws:iam::role/flow-log-role" # Replace with actual role
}

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/aws/vpc/flow-logs/hipaa-demo"
  retention_in_days = 365
}

# ─── KMS: Encryption Key with Rotation ──────────────────────────

resource "aws_kms_key" "app" {
  description         = "HIPAA demo app encryption key"
  enable_key_rotation = true # Automatic annual key rotation
}

resource "aws_kms_alias" "app" {
  name          = "alias/hipaa-demo-app"
  target_key_id = aws_kms_key.app.key_id
}

# ─── SNS: Encrypted Alert Topic ─────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name              = "hipaa-demo-alerts"
  kms_master_key_id = aws_kms_key.app.id
}

# ─── Lambda: Secured Function ───────────────────────────────────

resource "aws_lambda_function" "processor" {
  function_name = "hipaa-demo-processor"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_role.arn
  filename      = "lambda.zip"
  kms_key_arn   = aws_kms_key.app.arn # Encrypt environment variables

  environment {
    variables = {
      # Secrets fetched at runtime from Secrets Manager — not hardcoded
      DB_SECRET_ARN = aws_secretsmanager_secret.db_password.arn
    }
  }

  vpc_config {
    subnet_ids         = [] # Replace with actual private subnet IDs
    security_group_ids = [aws_security_group.app.id]
  }

  dead_letter_config {
    target_arn = aws_sns_topic.alerts.arn
  }

  tracing_config {
    mode = "Active"
  }
}

resource "aws_iam_role" "lambda_role" {
  name = "hipaa-demo-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}
