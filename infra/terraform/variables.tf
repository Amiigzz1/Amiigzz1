variable "project" {
  description = "Project slug used to tag and name resources"
  type        = string
  default     = "majlis"
}

variable "environment" {
  description = "Deployment environment: dev, staging, or prod"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "primary_region" {
  description = "Primary AWS region (Bahrain for MENA data localization)"
  type        = string
  default     = "me-south-1"
}

variable "secondary_region" {
  description = "Secondary AWS region (UAE) for multi-region resilience"
  type        = string
  default     = "me-central-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the primary VPC"
  type        = string
  default     = "10.20.0.0/16"
}
