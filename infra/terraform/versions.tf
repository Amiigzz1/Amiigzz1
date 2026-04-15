terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  # TODO(phase-0): move state to S3 + DynamoDB locks before `terraform apply`.
  # backend "s3" {
  #   bucket         = "majlis-tfstate"
  #   key            = "global/majlis.tfstate"
  #   region         = "me-south-1"
  #   dynamodb_table = "majlis-tfstate-locks"
  #   encrypt        = true
  # }
}
