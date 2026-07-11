# HIPAA Demo App — Infrastructure
#
# INTENTIONALLY INSECURE for em-dash demo purposes.
# Every resource here has at least one HIPAA violation.

provider "aws" {
  region = "us-east-1"
}

# VIOLATION: S3 bucket without encryption — §164.312(a)(2)(iv)
# VIOLATION: S3 bucket without versioning — §164.312(c)(1)
# VIOLATION: S3 bucket without public access block — §164.312(a)(1)
resource "aws_s3_bucket" "patient_records" {
  bucket = "hipaa-demo-patient-records"
  # No server_side_encryption_configuration
  # No versioning
  # No public_access_block
}

# VIOLATION: RDS without encryption — §164.312(a)(2)(iv)
# VIOLATION: RDS without SSL enforcement — §164.312(e)(1)
# VIOLATION: RDS publicly accessible — §164.312(a)(1)
resource "aws_db_instance" "patients" {
  identifier     = "hipaa-demo-patients"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  username       = "admin"
  password       = "SuperSecret123!"  # VIOLATION: hardcoded password

  storage_encrypted   = false  # No encryption at rest
  publicly_accessible = true   # Open to the internet
  skip_final_snapshot = true

  # No ssl enforcement
  # No audit logging (no parameter group with pgaudit)
  # No backup retention beyond default
}

# VIOLATION: IAM policy with wildcard — §164.308(a)(4)
resource "aws_iam_policy" "app_policy" {
  name = "hipaa-demo-app-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "*"       # Wildcard — violates least privilege
        Resource = "*"       # All resources — violates least privilege
      }
    ]
  })
}

# VIOLATION: Security group with 0.0.0.0/0 — §164.312(a)(1)
resource "aws_security_group" "app" {
  name        = "hipaa-demo-app"
  description = "App security group"

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Open to the world
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# VIOLATION: No CloudTrail — §164.312(b)
# (Absence of CloudTrail resource means no audit logging)

# VIOLATION: No VPC flow logs — §164.312(b)
# (Absence of flow log resource means no network monitoring)

# VIOLATION: No KMS key rotation — §164.312(a)(2)(iv)
resource "aws_kms_key" "app" {
  description         = "App encryption key"
  enable_key_rotation = false  # Should be true
}

# VIOLATION: SNS topic without encryption — §164.312(a)(2)(iv)
resource "aws_sns_topic" "alerts" {
  name = "hipaa-demo-alerts"
  # No kms_master_key_id
}

# VIOLATION: Lambda without KMS encryption for env vars — §164.312(a)(2)(iv)
resource "aws_lambda_function" "processor" {
  function_name = "hipaa-demo-processor"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_policy.app_policy.arn
  filename      = "lambda.zip"

  environment {
    variables = {
      DATABASE_URL = "postgresql://admin:SuperSecret123!@db.example.com/patients"  # Secret in env
      API_KEY      = "sk-1234567890"  # Secret in env
    }
  }

  # No kms_key_arn for env var encryption
  # No VPC config (Lambda runs outside VPC)
  # No dead letter queue
}
