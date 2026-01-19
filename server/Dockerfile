# ============================================================
# MULTI-STAGE DOCKERFILE - Spendwise Server
# Purpose: Create optimized, secure container image
# 
# Stage 1 (builder): Install dependencies and prepare app
# Stage 2 (production): Minimal runtime image
#
# Why Multi-Stage:
# - Smaller final image (security + faster deploys)
# - Build tools not shipped to production
# - Better layer caching
# ============================================================

# ============================================================
# STAGE 1: BUILDER
# Purpose: Install all dependencies including dev deps
# ============================================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --only=production

# Copy source code
COPY . .

# ============================================================
# STAGE 2: PRODUCTION
# Purpose: Minimal runtime image for deployment
# ============================================================
FROM node:20-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy only production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Remove unnecessary files
RUN rm -rf .env .env.example .gitignore

# Security: Set non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "index.js"]
