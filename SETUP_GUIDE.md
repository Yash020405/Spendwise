# Complete CI/CD Setup Guide - Step by Step

## Prerequisites Checklist
- [ ] GitHub account with repository
- [ ] DockerHub account  
- [ ] AWS account (for EKS)
- [ ] MongoDB Atlas account (free tier works)

---

## STEP 1: Install Required Tools (10 minutes)

### 1.1 Install AWS CLI
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

### 1.2 Install Terraform
```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
terraform --version
```

### 1.3 Install kubectl
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client
```

### 1.4 Configure AWS
```bash
aws configure
# Enter: AWS Access Key ID
# Enter: AWS Secret Access Key
# Region: us-east-1
# Output: json
```

---

## STEP 2: DockerHub Setup (5 minutes)

### 2.1 Create Access Token
1. Go to https://hub.docker.com/ → Log in
2. Click profile → **Account Settings** → **Security**
3. Click **New Access Token**
4. Name: `github-actions`, Access: **Read, Write, Delete**
5. **COPY THE TOKEN**

**Save:**
```
DOCKERHUB_USERNAME = your-username
DOCKERHUB_TOKEN    = dckr_pat_xxxxxxxxx
```

---

## STEP 3: MongoDB Atlas Setup (10 minutes)

### 3.1 Create Free Cluster
1. Go to https://cloud.mongodb.com/ → Sign up/Log in
2. **Build a Database** → **FREE** tier → Create

### 3.2 Create Database User
1. **Database Access** → **Add New Database User**
2. Username: `spendwise-user`, Password: (generate secure)
3. Permissions: **Read and write to any database**

### 3.3 Configure Network Access
1. **Network Access** → **Add IP Address**
2. **Allow Access from Anywhere** → Confirm

### 3.4 Get Connection String
1. **Database** → **Connect** → **Connect your application**
2. Copy and replace `<password>`:

```
MONGODB_URI = mongodb+srv://spendwise-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/spendwise
```

---

## STEP 4: Create Kubernetes Cluster with Terraform (15-20 minutes)

### 4.1 Initialize and Create Cluster
```bash
cd terraform

# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Create the cluster (takes ~15-20 minutes)
terraform apply
# Type 'yes' when prompted
```

### 4.2 Configure kubectl
```bash
aws eks update-kubeconfig --name spendwise-cluster --region us-east-1
```

### 4.3 Verify Cluster
```bash
kubectl get nodes
# Should show 2 nodes in Ready state
```

### 4.4 Get kubeconfig for GitHub Actions
```bash
cat ~/.kube/config | base64 -w 0
# Copy the ENTIRE output - this is your KUBE_CONFIG secret
```

---

## STEP 5: Configure GitHub Secrets (5 minutes)

1. Go to your GitHub repository
2. **Settings** → **Secrets and variables** → **Actions**
3. Add each secret:

| Secret Name | Value |
|-------------|-------|
| `DOCKERHUB_USERNAME` | Your DockerHub username |
| `DOCKERHUB_TOKEN` | Token from Step 2 |
| `KUBE_CONFIG` | Base64 output from Step 4.4 |
| `MONGODB_URI` | Connection string from Step 3.4 |
| `JWT_SECRET` | Any random string (e.g., `my-jwt-secret-2026`) |

---

## STEP 6: Push Code and Trigger CI/CD (5 minutes)

### 6.1 Push to GitHub
```bash
cd /path/to/Spendwise

git add .
git commit -m "Add CI/CD pipeline with Terraform"
git push origin main
```

### 6.2 Monitor CI Pipeline
1. Go to GitHub → **Actions** tab
2. Watch **CI Pipeline** run through all 12 stages
3. All stages should show green checkmarks

### 6.3 Monitor CD Pipeline
1. CD triggers automatically after CI succeeds
2. Watch deployment to Kubernetes

---

## STEP 7: Verify Everything Works (5 minutes)

### 7.1 Check Kubernetes Deployment
```bash
kubectl get deployment -n spendwise
kubectl get pods -n spendwise
kubectl get svc -n spendwise
```

### 7.2 Get Application URL
```bash
kubectl get svc spendwise-server -n spendwise -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### 7.3 Test the API
```bash
curl http://YOUR_LOAD_BALANCER_URL:3000/api/health
# Should return: {"success":true,"message":"Server is running"}
```

### 7.4 View in DockerHub
- Go to https://hub.docker.com/
- Find `your-username/spendwise-server`
- Verify image exists

### 7.5 View Security Scans
- GitHub → **Security** tab
- View CodeQL alerts
- View Trivy container scan results

---

## STEP 8: Cleanup (IMPORTANT - Avoid AWS Charges!)

### Delete Kubernetes Cluster
```bash
cd terraform
terraform destroy
# Type 'yes' when prompted
```

**Cost Warning:** EKS cluster costs ~$5/day. Always destroy when not using!

---

## Quick Reference - All Secrets

```
DOCKERHUB_USERNAME = your-dockerhub-username
DOCKERHUB_TOKEN    = dckr_pat_xxxxxxxxxxxx
KUBE_CONFIG        = (base64 encoded kubeconfig)
MONGODB_URI        = mongodb+srv://user:pass@cluster.mongodb.net/spendwise
JWT_SECRET         = your-random-jwt-secret
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `terraform init` fails | Check internet connection |
| `terraform apply` fails | Check AWS credentials: `aws sts get-caller-identity` |
| CI pipeline fails | Check GitHub Secrets are set correctly |
| Pods not starting | `kubectl logs <pod-name> -n spendwise` |
| No external IP | Wait 2-3 minutes for LoadBalancer |

---

## Timeline Summary

| Step | Time |
|------|------|
| Install tools | 10 mins |
| DockerHub setup | 5 mins |
| MongoDB setup | 10 mins |
| Terraform cluster | 15-20 mins |
| GitHub secrets | 5 mins |
| Push & verify | 10 mins |
| **Total** | **~55-60 mins** |
