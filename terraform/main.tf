# ============================================================
# EC2 + DOCKER - SPENDWISE SERVER
# Simple deployment: Pull Docker image and run
# Setup time: ~2-3 minutes
# ============================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-south-1"
}

variable "key_name" {
  description = "AWS Key Pair name for SSH access"
  type        = string
  default     = "devOps"
}

variable "dockerhub_username" {
  description = "DockerHub username"
  type        = string
  default     = "thetallinnov8r"
}

variable "mongodb_uri" {
  description = "MongoDB connection string"
  type        = string
  default     = ""  # Will use environment variable or default
}

variable "jwt_secret" {
  description = "JWT Secret for authentication"
  type        = string
  default     = "spendwise-jwt-secret-2026"
}

# EC2 Instance with Docker
resource "aws_instance" "spendwise_server" {
  ami           = "ami-0f5ee92e2d63afc18"  # Ubuntu 22.04 LTS in ap-south-1
  instance_type = "t2.medium"
  key_name      = var.key_name

  user_data = <<-EOF
              #!/bin/bash
              set -e
              exec > /var/log/user-data.log 2>&1
              
              echo "=== Starting Spendwise Server Setup ==="
              
              # Step 1: Install Docker
              echo "Installing Docker..."
              apt update -y
              apt install -y docker.io curl
              systemctl start docker
              systemctl enable docker
              usermod -aG docker ubuntu
              
              # Step 2: Pull Docker image
              echo "Pulling Docker image..."
              docker pull ${var.dockerhub_username}/spendwise-server:latest
              
              # Step 3: Run the container
              echo "Starting Spendwise server..."
              docker run -d \
                --name spendwise-server \
                --restart always \
                -p 3000:3000 \
                -e NODE_ENV=production \
                -e PORT=3000 \
                -e JWT_SECRET="${var.jwt_secret}" \
                -e MONGODB_URI="${var.mongodb_uri}" \
                ${var.dockerhub_username}/spendwise-server:latest
              
              # Step 4: Create helper scripts
              echo "Creating helper scripts..."
              
              # Status script
              cat << 'STATUS_EOF' > /home/ubuntu/status.sh
              #!/bin/bash
              echo "=== Docker Containers ==="
              docker ps -a
              echo ""
              echo "=== Container Logs ==="
              docker logs --tail 20 spendwise-server
              STATUS_EOF
              chmod +x /home/ubuntu/status.sh
              
              # Restart script
              cat << 'RESTART_EOF' > /home/ubuntu/restart.sh
              #!/bin/bash
              docker restart spendwise-server
              echo "Server restarted!"
              RESTART_EOF
              chmod +x /home/ubuntu/restart.sh
              
              # Update/redeploy script
              cat << 'UPDATE_EOF' > /home/ubuntu/update.sh
              #!/bin/bash
              echo "Pulling latest image..."
              docker pull thetallinnov8r/spendwise-server:latest
              docker stop spendwise-server
              docker rm spendwise-server
              docker run -d \
                --name spendwise-server \
                --restart always \
                -p 3000:3000 \
                -e NODE_ENV=production \
                -e PORT=3000 \
                -e JWT_SECRET="spendwise-jwt-secret-2026" \
                thetallinnov8r/spendwise-server:latest
              echo "Updated to latest version!"
              UPDATE_EOF
              chmod +x /home/ubuntu/update.sh
              
              chown ubuntu:ubuntu /home/ubuntu/*.sh
              
              # Wait for container to start
              sleep 5
              
              echo "=== Setup Complete! ==="
              PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
              echo "App URL: http://$PUBLIC_IP:3000"
              echo "Health Check: http://$PUBLIC_IP:3000/api/health"
              EOF

  vpc_security_group_ids = [aws_security_group.spendwise_sg.id]

  tags = {
    Name        = "spendwise-server"
    Project     = "Spendwise"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}

# Security Group
resource "aws_security_group" "spendwise_sg" {
  name        = "spendwise-server-sg"
  description = "Security group for Spendwise server"

  # SSH access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # App port
  ingress {
    description = "App Port"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "spendwise-server-sg"
    Project = "Spendwise"
  }
}

# Outputs
output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.spendwise_server.id
}

output "public_ip" {
  description = "Public IP of the server"
  value       = aws_instance.spendwise_server.public_ip
}

output "app_url" {
  description = "Application URL"
  value       = "http://${aws_instance.spendwise_server.public_ip}:3000"
}

output "health_check" {
  description = "Health check URL"
  value       = "http://${aws_instance.spendwise_server.public_ip}:3000/api/health"
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.spendwise_server.public_ip}"
}
