# Multi-stage build for Google Cloud Run
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (pg, bcryptjs, etc.)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
# Cache bust: 2026-02-10 super-admin route added
COPY . .

# Build the application (Vite will output to dist/)
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install build dependencies for native modules (pg, bcryptjs, etc.)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy all source code (including integrations, config, utils, etc.)
# This ensures all internal modules are available
COPY --from=builder /app/src ./src

# Copy TypeScript config if needed
COPY --from=builder /app/tsconfig*.json ./

# Install tsx for running TypeScript directly (or use ts-node)
RUN npm install -g tsx

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production

# Health check (uses PORT env var or defaults to 8080)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the server using npm script (Cloud Run will set PORT automatically)
CMD ["npm", "run", "start:prod"]
