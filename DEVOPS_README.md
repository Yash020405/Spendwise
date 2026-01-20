# Spendwise DevOps - CI/CD Pipeline Documentation

## Project Overview

Spendwise is a full-stack expense tracking application with a **production-grade CI/CD pipeline** implementing DevSecOps best practices.

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Database | MongoDB Atlas |
| Container | Docker (multi-stage) |
| Orchestration | Kubernetes (Minikube on EC2) |
| Infrastructure | Terraform (AWS) |
| CI/CD | GitHub Actions |

---

## Quick Start - Run Locally

### Prerequisites
- Node.js v20+
- Docker
- MongoDB (local or Atlas)

### Backend Server
```bash
cd server
cp .env.example .env
# Edit .env with your MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

### Run Tests
```bash
cd server
npm test
```

### Build Docker Image
```bash
cd server
docker build -t spendwise-server .
docker run -p 3000:3000 \
  -e MONGODB_URI=your_uri \
  -e JWT_SECRET=your_secret \
  spendwise-server
```

---

## Secrets Configuration

### GitHub Repository Secrets

Navigate to: **Repository → Settings → Secrets and Variables → Actions**

| Secret Name | Purpose | Example |
|-------------|---------|---------|
| `DOCKERHUB_USERNAME` | Docker registry authentication | `username` |
| `DOCKERHUB_TOKEN` | Docker registry access token | `dckr_pat_xxx` |
| `EC2_SSH_KEY` | SSH private key for deployment | `-----BEGIN OPENSSH...` |
| `EC2_HOST` | EC2 public IP address | `13.232.94.219` |

### Terraform Variables (terraform/terraform.tfvars)

```hcl
key_name           = "your-aws-keypair"
dockerhub_username = "your-dockerhub-user"
mongodb_uri        = "mongodb+srv://..." # SENSITIVE
jwt_secret         = "your-jwt-secret"   # SENSITIVE
```

> ⚠️ **IMPORTANT**: `terraform.tfvars` is gitignored. Never commit secrets.

---

## CI/CD Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CI PIPELINE                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Code Quality│  │ SAST Scan   │  │ SCA Scan    │  PARALLEL    │
│  │ (ESLint)    │  │ (CodeQL)    │  │ (npm audit) │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│                 ┌─────────────────┐                              │
│                 │ Build & Test    │                              │
│                 │ (24 Unit Tests) │                              │
│                 └────────┬────────┘                              │
│                          ▼                                       │
│                 ┌─────────────────┐                              │
│                 │ Container Build │                              │
│                 │ (Docker)        │                              │
│                 └────────┬────────┘                              │
│                          ▼                                       │
│                 ┌─────────────────┐                              │
│                 │ Container Scan  │                              │
│                 │ (Trivy)         │                              │
│                 └────────┬────────┘                              │
│                          ▼                                       │
│                 ┌─────────────────┐                              │
│                 │ Publish         │                              │
│                 │ (DockerHub)     │                              │
│                 └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼ (on success)
┌─────────────────────────────────────────────────────────────────┐
│                         CD PIPELINE                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                                            │
│  │ Deploy to K8s   │ kubectl rollout restart                    │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Verify Health   │ curl /api/health (with retry)              │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ DAST Scan       │ Custom security tests via SSH              │
│  │ (Security)      │                                            │
│  └─────────────────┘                                            │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │ Rollback        │ Auto on failure (kubectl rollout undo)     │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## CI Pipeline Stages (7 Stages)

### Stage 1-3: Security Scans (Parallel)

| Stage | Tool | Purpose |
|-------|------|---------|
| Code Quality | ESLint | Linting and code style |
| SAST | CodeQL v4 | Static security analysis |
| SCA | npm audit | Dependency vulnerabilities |

### Stage 4: Build & Test
- Runs 24 unit tests covering validation, security, and API logic
- Syntax validation with `node --check`

### Stage 5: Container Build
- Multi-stage Docker build
- Health check before proceeding
- Layer caching for speed

### Stage 6: Container Scan
- Trivy vulnerability scanner
- SARIF report to GitHub Security tab
- Scans for CRITICAL and HIGH severity CVEs

### Stage 7: Publish
- Pushes to DockerHub with commit SHA and `latest` tags

---

## CD Pipeline Stages (4 Stages)

### Stage 1: Deploy
- SSH into EC2 running Minikube
- Rolling restart with zero downtime

### Stage 2: Verify
- Health check with 6 retries (15s intervals)
- Ensures application is responding

### Stage 3: DAST (Custom Security Tests)
- Custom security scan via SSH on live application
- Checks security headers, error handling, info disclosure
- Security Headers Score: 6/6 with helmet middleware

### Stage 4: Rollback (Conditional)
- Triggers automatically if deploy/verify fails
- `kubectl rollout undo` to previous version

---

## Security Controls Summary

| Layer | Tool | What It Catches |
|-------|------|-----------------|
| SAST | CodeQL | Code vulnerabilities, injection flaws |
| SCA | npm audit | Known dependency CVEs |
| Container | Trivy | Docker image vulnerabilities |
| DAST | Custom SSH Tests | Runtime security issues, headers |
| Runtime | Rate Limiting | DDoS, brute force attacks |
| Runtime | Helmet | Security headers (6/6) |

---

## File Structure

```
Spendwise/
├── .github/workflows/
│   ├── ci.yml              # CI Pipeline (7 stages)
│   └── cd.yml              # CD Pipeline (4 stages)
├── server/
│   ├── Dockerfile          # Multi-stage build
│   ├── index.js            # Express server
│   ├── routes/             # API routes
│   ├── models/             # MongoDB schemas
│   └── __tests__/          # Unit tests
├── k8s/
│   ├── deployment.yaml     # K8s Deployment
│   ├── service.yaml        # K8s Service
│   └── configmap.yaml      # Non-sensitive config
└── terraform/
    └── main.tf             # EC2 + Minikube setup
```

---

## Deployment Commands

### Deploy Infrastructure
```bash
cd terraform
terraform init
terraform apply
```

### Check Kubernetes Status
```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_IP> './status.sh'
```

### View Logs
```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_IP> './logs.sh'
```

---

## License

MIT License - See [LICENSE](LICENSE) for details.
