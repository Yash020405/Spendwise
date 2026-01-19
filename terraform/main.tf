# ============================================================
# EC2 + MINIKUBE (KUBERNETES) - SPENDWISE SERVER
# Fully automated Kubernetes deployment
# Setup time: ~3-5 minutes
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
  default     = "mongodb+srv://yashaga0204_db_user:4VTmqvGDWycaRZJ5@cluster0.ergxeka.mongodb.net/spendwise?retryWrites=true&w=majority"
}

variable "jwt_secret" {
  description = "JWT Secret for authentication"
  type        = string
  default     = "pocketexpense2025Sdjfndfdl@Atlsddfnsdflns75365431131zsdnakd556"
}

# EC2 Instance with Minikube
resource "aws_instance" "spendwise_k8s" {
  ami           = "ami-0f5ee92e2d63afc18"  # Ubuntu 22.04 LTS in ap-south-1
  instance_type = "t2.medium"               # 2 vCPU, 4GB RAM for Minikube
  key_name      = var.key_name

  user_data = <<-EOF
              #!/bin/bash
              set -e
              exec > /var/log/user-data.log 2>&1
              
              echo "=== Starting Kubernetes Setup ==="
              
              # -----------------------------------------
              # Step 1: Install Docker
              # -----------------------------------------
              echo "Installing Docker..."
              apt update -y
              apt install -y docker.io curl conntrack
              systemctl start docker
              systemctl enable docker
              usermod -aG docker ubuntu
              
              # -----------------------------------------
              # Step 2: Install kubectl
              # -----------------------------------------
              echo "Installing kubectl..."
              curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
              install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
              rm kubectl
              
              # -----------------------------------------
              # Step 3: Install Minikube
              # -----------------------------------------
              echo "Installing Minikube..."
              curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
              install minikube-linux-amd64 /usr/local/bin/minikube
              rm minikube-linux-amd64
              
              # -----------------------------------------
              # Step 4: Start Minikube (as ubuntu user)
              # -----------------------------------------
              echo "Starting Minikube..."
              sudo -u ubuntu bash -c 'minikube start --driver=docker --force'
              
              # Wait for Minikube to be ready
              sleep 30
              
              # -----------------------------------------
              # Step 5: Create Kubernetes Resources
              # -----------------------------------------
              echo "Creating K8s namespace..."
              sudo -u ubuntu kubectl create namespace spendwise || true
              
              # Create Secret for sensitive data
              echo "Creating K8s secrets..."
              sudo -u ubuntu kubectl create secret generic spendwise-secrets \
                --namespace=spendwise \
                --from-literal=mongodb-uri='${var.mongodb_uri}' \
                --from-literal=jwt-secret='${var.jwt_secret}' \
                --dry-run=client -o yaml | sudo -u ubuntu kubectl apply -f -
              
              # Create Deployment
              echo "Creating K8s deployment..."
              sudo -u ubuntu bash -c 'cat << DEPLOY_EOF | kubectl apply -f -
              apiVersion: apps/v1
              kind: Deployment
              metadata:
                name: spendwise-server
                namespace: spendwise
                labels:
                  app: spendwise
              spec:
                replicas: 2
                selector:
                  matchLabels:
                    app: spendwise
                strategy:
                  type: RollingUpdate
                  rollingUpdate:
                    maxSurge: 1
                    maxUnavailable: 0
                template:
                  metadata:
                    labels:
                      app: spendwise
                  spec:
                    containers:
                    - name: server
                      image: ${var.dockerhub_username}/spendwise-server:latest
                      imagePullPolicy: Always
                      ports:
                      - containerPort: 3000
                      env:
                      - name: NODE_ENV
                        value: "production"
                      - name: PORT
                        value: "3000"
                      - name: MONGODB_URI
                        valueFrom:
                          secretKeyRef:
                            name: spendwise-secrets
                            key: mongodb-uri
                      - name: JWT_SECRET
                        valueFrom:
                          secretKeyRef:
                            name: spendwise-secrets
                            key: jwt-secret
                      resources:
                        requests:
                          memory: "128Mi"
                          cpu: "100m"
                        limits:
                          memory: "512Mi"
                          cpu: "500m"
                      livenessProbe:
                        httpGet:
                          path: /api/health
                          port: 3000
                        initialDelaySeconds: 30
                        periodSeconds: 10
                      readinessProbe:
                        httpGet:
                          path: /api/health
                          port: 3000
                        initialDelaySeconds: 5
                        periodSeconds: 5
              DEPLOY_EOF'
              
              # Create Service
              echo "Creating K8s service..."
              sudo -u ubuntu bash -c 'cat << SVC_EOF | kubectl apply -f -
              apiVersion: v1
              kind: Service
              metadata:
                name: spendwise-server
                namespace: spendwise
              spec:
                type: NodePort
                selector:
                  app: spendwise
                ports:
                - protocol: TCP
                  port: 3000
                  targetPort: 3000
                  nodePort: 30000
              SVC_EOF'
              
              # Wait for pods to be ready
              echo "Waiting for pods to be ready..."
              sudo -u ubuntu kubectl rollout status deployment/spendwise-server -n spendwise --timeout=180s || true
              
              # -----------------------------------------
              # Step 6: Setup Port Forwarding Service
              # -----------------------------------------
              echo "Setting up port forwarding..."
              cat << 'SYSTEMD_EOF' > /etc/systemd/system/k8s-port-forward.service
              [Unit]
              Description=Kubernetes Port Forward for Spendwise
              After=network.target
              
              [Service]
              Type=simple
              User=ubuntu
              ExecStartPre=/bin/sleep 10
              ExecStart=/usr/local/bin/kubectl port-forward --address 0.0.0.0 svc/spendwise-server 3000:3000 -n spendwise
              Restart=always
              RestartSec=10
              
              [Install]
              WantedBy=multi-user.target
              SYSTEMD_EOF
              
              systemctl daemon-reload
              systemctl enable k8s-port-forward
              systemctl start k8s-port-forward
              
              # -----------------------------------------
              # Step 7: Create helper scripts
              # -----------------------------------------
              echo "Creating helper scripts..."
              
              # Status script
              cat << 'STATUS_EOF' > /home/ubuntu/status.sh
              #!/bin/bash
              echo "=== Minikube Status ==="
              minikube status
              echo ""
              echo "=== Pods ==="
              kubectl get pods -n spendwise
              echo ""
              echo "=== Services ==="
              kubectl get svc -n spendwise
              echo ""
              echo "=== Deployment ==="
              kubectl get deployment -n spendwise
              STATUS_EOF
              chmod +x /home/ubuntu/status.sh
              
              # Redeploy script (for CD pipeline)
              cat << 'REDEPLOY_EOF' > /home/ubuntu/redeploy.sh
              #!/bin/bash
              echo "Restarting deployment to pull latest image..."
              kubectl rollout restart deployment/spendwise-server -n spendwise
              kubectl rollout status deployment/spendwise-server -n spendwise --timeout=120s
              echo "Redeployment complete!"
              REDEPLOY_EOF
              chmod +x /home/ubuntu/redeploy.sh
              
              # Logs script
              cat << 'LOGS_EOF' > /home/ubuntu/logs.sh
              #!/bin/bash
              kubectl logs -l app=spendwise -n spendwise --tail=50
              LOGS_EOF
              chmod +x /home/ubuntu/logs.sh
              
              chown ubuntu:ubuntu /home/ubuntu/*.sh
              
              echo "=== Kubernetes Setup Complete! ==="
              PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
              echo "App URL: http://$PUBLIC_IP:3000"
              echo "Health Check: http://$PUBLIC_IP:3000/api/health"
              EOF

  vpc_security_group_ids = [aws_security_group.spendwise_sg.id]

  tags = {
    Name        = "spendwise-k8s-server"
    Project     = "Spendwise"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}

# Security Group
resource "aws_security_group" "spendwise_sg" {
  name        = "spendwise-k8s-sg"
  description = "Security group for Spendwise K8s server"

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

  # K8s NodePort range
  ingress {
    description = "K8s NodePort"
    from_port   = 30000
    to_port     = 32767
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
    Name    = "spendwise-k8s-sg"
    Project = "Spendwise"
  }
}

# Outputs
output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.spendwise_k8s.id
}

output "public_ip" {
  description = "Public IP of the K8s server"
  value       = aws_instance.spendwise_k8s.public_ip
}

output "app_url" {
  description = "Application URL"
  value       = "http://${aws_instance.spendwise_k8s.public_ip}:3000"
}

output "health_check" {
  description = "Health check URL"
  value       = "http://${aws_instance.spendwise_k8s.public_ip}:3000/api/health"
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.spendwise_k8s.public_ip}"
}

output "kubectl_status" {
  description = "Command to check K8s status"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.spendwise_k8s.public_ip} './status.sh'"
}
