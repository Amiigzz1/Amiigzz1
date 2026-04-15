output "vpc_id" {
  value       = aws_vpc.main.id
  description = "Primary VPC id"
}

output "ecs_cluster_arn" {
  value       = aws_ecs_cluster.main.arn
  description = "ECS cluster ARN (API + realtime)"
}

output "uploads_bucket" {
  value       = aws_s3_bucket.uploads.bucket
  description = "S3 bucket for user uploads"
}
