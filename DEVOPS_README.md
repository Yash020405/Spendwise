# Spendwise DevOps CI/CD Pipeline

## Project Overview

**Spendwise** is an expense tracking application with a Node.js/Express backend. This document describes the production-grade CI/CD pipeline implementation using GitHub Actions, Docker, and Kubernetes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CI/CD PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────┐    ┌─────────────────────────────────────────────────┐    │
│  │  Push   │───▶│              CI PIPELINE                         │    │
│  │ to main │    │  Lint → SAST → SCA → Test → Build → Scan → Push │    │
│  └─────────┘    └─────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│                 ┌─────────────────────────────────────────────────┐    │
│                 │              CD PIPELINE                         │    │
│                 │  Deploy → Rollout → DAST → Verify                │    │
│                 └─────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│                           ┌───────────────┐                             │
│                           │  KUBERNETES   │                             │
│                           │   CLUSTER     │                             │
│                           └───────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## CI Pipeline Stages

| # | Stage | Tool | Purpose | Why It Matters |
|---|-------|------|---------|----------------|
| 1 | Checkout | actions/checkout | Get source code | Foundation for pipeline |
| 2 | Setup Node.js | actions/setup-node | Install runtime | Required for build/test |
| 3 | Install Dependencies | npm ci | Clean install | Reproducible builds |
| 4 | Linting | ESLint | Code quality | Prevents technical debt |
| 5 | SAST | CodeQL | Security analysis | Detects OWASP Top 10 |
| 6 | SCA | npm audit + Snyk | Dependency scan | Supply chain security |
| 7 | Unit Tests | Jest | Test execution | Prevents regressions |
| 8 | Build Verification | Node check | Validate build | Catches build errors |
| 9 | Docker Build | Buildx | Container creation | Consistent runtime |
| 10 | Image Scan | Trivy | Container CVEs | Prevent vulnerable images |
| 11 | Container Test | Docker run | Smoke test | Verify image runs |
| 12 | Push | DockerHub | Registry upload | Enable deployment |

---

## CD Pipeline Stages

| # | Stage | Tool | Purpose |
|---|-------|------|---------|
| 1 | Checkout | actions/checkout | Get K8s manifests |
| 2 | Configure kubectl | azure/k8s-set-context | Set up K8s credentials |
| 3 | Deploy Secrets | kubectl | Inject secrets |
| 4 | Deploy Application | kubectl apply | Apply manifests |
| 5 | Wait for Rollout | kubectl rollout | Ensure pods ready |
| 6 | DAST | OWASP ZAP | Runtime security scan |

---

## Setup Instructions

### Prerequisites

- GitHub account with repository
- DockerHub account
- Kubernetes cluster (AWS EKS / Minikube / Kind)
- MongoDB instance (MongoDB Atlas recommended)

### Step 1: Configure GitHub Secrets

Navigate to: **Repository → Settings → Secrets and variables → Actions**

Add the following secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DOCKERHUB_USERNAME` | Your DockerHub username | `johndoe` |
| `DOCKERHUB_TOKEN` | DockerHub access token | `dckr_pat_xxx` |
| `KUBE_CONFIG` | Base64 encoded kubeconfig | See below |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-xxx` |
| `SNYK_TOKEN` | Snyk API token (optional) | `snyk-xxx` |

### Step 2: Create DockerHub Access Token

1. Go to [DockerHub](https://hub.docker.com/)
2. Account Settings → Security → New Access Token
3. Name: `github-actions`
4. Copy the token and add as `DOCKERHUB_TOKEN` secret

### Step 3: Set Up Kubernetes Cluster

#### Option A: AWS EKS (Recommended for Production)

```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create EKS cluster
eksctl create cluster \
  --name spendwise-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2

# Get kubeconfig
aws eks update-kubeconfig --name spendwise-cluster --region us-east-1

# Encode kubeconfig for GitHub secret
cat ~/.kube/config | base64 -w 0
```

#### Option B: Minikube (Local Development)

```bash
# Install minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Start cluster
minikube start --driver=docker

# Get kubeconfig
cat ~/.kube/config | base64 -w 0
```

### Step 4: Push Code to Trigger CI

```bash
cd /path/to/Spendwise
git add .
git commit -m "Add CI/CD pipeline"
git push origin main
```

---

## File Structure

```
Spendwise/
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI Pipeline
│       └── cd.yml              # CD Pipeline
├── k8s/
│   ├── deployment.yaml         # Kubernetes Deployment
│   ├── service.yaml            # Kubernetes Service
│   └── configmap.yaml          # ConfigMap
├── server/
│   ├── __tests__/
│   │   └── health.test.js      # Unit tests
│   ├── .eslintrc.json          # ESLint config
│   ├── jest.config.js          # Jest config
│   ├── Dockerfile              # Container build
│   ├── .dockerignore           # Docker ignore
│   └── package.json            # Updated with scripts
└── DEVOPS_README.md            # This file
```

---

## Running Locally

### Install Dependencies

```bash
cd server
npm install
```

### Run Tests

```bash
npm test
```

### Run Linting

```bash
npm run lint
```

### Build Docker Image

```bash
docker build -t spendwise-server:local ./server
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e MONGODB_URI=your-mongodb-uri \
  -e JWT_SECRET=your-secret \
  spendwise-server:local
```

---

## Security Controls

| Control | Tool | Stage | Purpose |
|---------|------|-------|---------|
| SAST | CodeQL | CI | Static code vulnerability detection |
| SCA | npm audit / Snyk | CI | Dependency vulnerability scanning |
| Container Scan | Trivy | CI | OS/library CVE detection |
| DAST | OWASP ZAP | CD | Runtime vulnerability scanning |
| Secrets Management | GitHub Secrets | CI/CD | Secure credential storage |
| Non-root Container | Dockerfile | Build | Principle of least privilege |

---

## Monitoring CI/CD

### View Pipeline Status

1. Go to **Actions** tab in GitHub repository
2. Click on the workflow run
3. View logs for each stage

### View Security Findings

1. Go to **Security** tab in GitHub repository
2. View CodeQL alerts
3. View Dependabot alerts

---

## Troubleshooting

### CI Pipeline Failures

| Error | Solution |
|-------|----------|
| `npm ci` fails | Check package-lock.json is committed |
| ESLint errors | Run `npm run lint:fix` locally |
| Docker build fails | Check Dockerfile syntax |
| Trivy scan fails | Review CVE findings, update dependencies |

### CD Pipeline Failures

| Error | Solution |
|-------|----------|
| kubectl fails | Check KUBE_CONFIG secret is valid |
| Deployment timeout | Check pod logs with `kubectl logs` |
| Service not accessible | Check service type and ports |

---

## Author

**Spendwise Development Team**

---

## License

ISC
