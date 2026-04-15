# Majlis — Terraform

Skeleton only. **Do not `terraform apply`** yet.

Open tasks before first apply:

1. Finalize remote state backend (S3 + DynamoDB locks) in `versions.tf`.
2. Add `terraform-aws-modules/vpc/aws` (3 AZs, public + private subnets, NAT).
3. Populate `aws_db_subnet_group` and `aws_elasticache_subnet_group` with the
   VPC module's private subnet ids.
4. Add RDS Postgres + ElastiCache Redis resources.
5. Add ECS services + ALB for API and realtime.
6. Add CloudFront distribution in front of the `uploads` bucket.
7. Add WAF in front of the ALB (rate-limit, bot rules).

## Regions

- Primary: `me-south-1` (Bahrain) — PDPL data localization.
- Secondary: `me-central-1` (UAE) — DR + lower latency for UAE users.

## Workflow

```bash
cd infra/terraform
terraform init
terraform plan  -var "environment=dev"
# terraform apply — NOT YET
```
