############################################################
# Majlis — AWS infrastructure skeleton (Phase 0)
#
# This file declares the *shape* of the infrastructure. DO NOT
# `terraform apply` yet — state backend and real CIDRs/sizing
# must be finalized first. See docs/ARCHITECTURE.md.
############################################################

provider "aws" {
  region = var.primary_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Compliance  = "PDPL"
    }
  }
}

locals {
  name_prefix = "${var.project}-${var.environment}"
}

# ---------------- Networking ----------------
# TODO(phase-0): swap to terraform-aws-modules/vpc/aws for AZ/NAT setup.
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

# ---------------- Data stores ----------------
# Postgres (RDS) — actual subnet group + parameter group come in Phase 1.
resource "aws_db_subnet_group" "postgres" {
  name        = "${local.name_prefix}-pg"
  description = "Subnet group for Majlis Postgres"
  subnet_ids  = [] # TODO(phase-0): add private subnets created by VPC module
  tags = {
    Name = "${local.name_prefix}-pg"
  }
}

# Redis (ElastiCache) — placeholder subnet group.
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${local.name_prefix}-redis"
  description = "Subnet group for Majlis Redis"
  subnet_ids  = [] # TODO(phase-0): add private subnets
}

# ---------------- Compute ----------------
# ECS cluster for API + realtime services (Fargate).
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-ecs"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ---------------- Storage ----------------
# S3 bucket for user uploads (avatars, voice clips for moderation review).
# Region: me-south-1 (Bahrain) to satisfy PDPL data localization.
resource "aws_s3_bucket" "uploads" {
  bucket        = "${local.name_prefix}-uploads"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
