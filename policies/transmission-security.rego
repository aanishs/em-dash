package compliance.transmission_security

# Transmission Security — ensures sensitive data is encrypted in transit and network access is restricted

# AWS — Security groups must not allow 0.0.0.0/0 on sensitive ports
deny[msg] {
    resource := input.resource.aws_security_group_rule[name]
    resource.type == "ingress"
    resource.cidr_blocks[_] == "0.0.0.0/0"
    sensitive_ports := {22, 3306, 5432, 27017, 1433}
    sensitive_ports[resource.from_port]
    msg := {
        "msg": sprintf("Security group rule '%s' allows 0.0.0.0/0 on sensitive port %d", [name, resource.from_port]),
        "check_id": "rego-aws-sg-rule-open",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — Security groups must not allow 0.0.0.0/0 on sensitive port ranges
deny[msg] {
    resource := input.resource.aws_security_group[name]
    ingress := resource.ingress[_]
    ingress.cidr_blocks[_] == "0.0.0.0/0"
    sensitive_ports := {22, 3306, 5432, 27017, 1433}
    port := sensitive_ports[_]
    port >= ingress.from_port
    port <= ingress.to_port
    msg := {
        "msg": sprintf("Security group '%s' allows 0.0.0.0/0 ingress on port %d", [name, port]),
        "check_id": "rego-aws-sg-open",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — ALB/NLB listeners must use HTTPS
deny[msg] {
    resource := input.resource.aws_lb_listener[name]
    resource.protocol != "HTTPS"
    resource.protocol != "TLS"
    msg := {
        "msg": sprintf("Load balancer listener '%s' uses protocol '%s' instead of HTTPS/TLS", [name, resource.protocol]),
        "check_id": "rego-aws-lb-https",
        "severity": "HIGH",
        "resource": name,
    }
}

# AWS — RDS instances must not be publicly accessible
deny[msg] {
    resource := input.resource.aws_db_instance[name]
    resource.publicly_accessible == true
    msg := {
        "msg": sprintf("RDS instance '%s' is publicly accessible", [name]),
        "check_id": "rego-rds-public",
        "severity": "CRITICAL",
        "resource": name,
    }
}

# Database connections must enforce SSL (sslmode != disable)
deny[msg] {
    resource := input.resource.aws_db_instance[name]
    not resource.parameter_group_name
    msg := {
        "msg": sprintf("RDS instance '%s' may not enforce SSL — verify parameter group requires ssl", [name]),
        "check_id": "rego-aws-rds-sg-open",
        "severity": "MEDIUM",
        "resource": name,
    }
}

# GCP — Cloud SQL must require SSL
deny[msg] {
    resource := input.resource.google_sql_database_instance[name]
    settings := resource.settings[_]
    ip_config := settings.ip_configuration
    not ip_config.require_ssl
    msg := {
        "msg": sprintf("Cloud SQL instance '%s' does not require SSL for connections", [name]),
        "check_id": "rego-gcp-sql-authorized-networks",
        "severity": "HIGH",
        "resource": name,
    }
}

# GCP — Cloud SQL should not have public IP enabled
deny[msg] {
    resource := input.resource.google_sql_database_instance[name]
    settings := resource.settings[_]
    ip_config := settings.ip_configuration
    ip_config.ipv4_enabled == true
    msg := {
        "msg": sprintf("Cloud SQL instance '%s' has public IPv4 enabled — use private IP only", [name]),
        "check_id": "rego-gcp-sql-public-ip",
        "severity": "HIGH",
        "resource": name,
    }
}

# GCP — Firewall rules must not allow 0.0.0.0/0 on sensitive ports
deny[msg] {
    resource := input.resource.google_compute_firewall[name]
    resource.direction == "INGRESS"
    resource.source_ranges[_] == "0.0.0.0/0"
    allowed := resource.allow[_]
    sensitive_ports := {"22", "3306", "5432", "27017", "1433"}
    allowed.ports[_] == sensitive_ports[_]
    msg := {
        "msg": sprintf("GCP firewall rule '%s' allows 0.0.0.0/0 on sensitive port", [name]),
        "check_id": "rego-gcp-firewall-open",
        "severity": "HIGH",
        "resource": name,
    }
}

# Azure — NSG rules must not allow 0.0.0.0/0 on sensitive ports
deny[msg] {
    resource := input.resource.azurerm_network_security_rule[name]
    resource.direction == "Inbound"
    resource.access == "Allow"
    resource.source_address_prefix == "*"
    sensitive_ports := {"22", "3306", "5432", "27017", "1433", "3389"}
    resource.destination_port_range == sensitive_ports[_]
    msg := {
        "msg": sprintf("Azure NSG rule '%s' allows inbound * on sensitive port %s", [name, resource.destination_port_range]),
        "check_id": "rego-azure-nsg-open",
        "severity": "HIGH",
        "resource": name,
    }
}

# Azure — App Service must use HTTPS only
deny[msg] {
    resource := input.resource.azurerm_app_service[name]
    not resource.https_only
    msg := {
        "msg": sprintf("Azure App Service '%s' does not enforce HTTPS-only", [name]),
        "check_id": "rego-azure-appservice-https",
        "severity": "HIGH",
        "resource": name,
    }
}

# GCP — Cloud Run must not allow unauthenticated invocations
deny[msg] {
    resource := input.resource.google_cloud_run_service_iam_member[name]
    resource.member == "allUsers"
    msg := {
        "msg": sprintf("Cloud Run IAM binding '%s' allows unauthenticated access", [name]),
        "check_id": "rego-gcp-cloudrun-public",
        "severity": "HIGH",
        "resource": name,
    }
}
