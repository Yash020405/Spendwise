# Terraform EKS Cluster Setup

## Prerequisites
- AWS CLI configured (`aws configure`)
- Terraform installed

## Quick Start

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Create infrastructure (~15-20 mins)
terraform apply

# Configure kubectl
aws eks update-kubeconfig --name spendwise-cluster --region us-east-1

# Verify
kubectl get nodes

# Get kubeconfig for GitHub Actions
cat ~/.kube/config | base64 -w 0
```

## Cleanup (IMPORTANT - to avoid charges)

```bash
terraform destroy
```

## Cost Estimate
- EKS Control Plane: ~$0.10/hour
- 2x t3.small nodes: ~$0.04/hour
- NAT Gateway: ~$0.045/hour
- **Total: ~$0.20/hour or ~$5/day**

Delete when not using!
