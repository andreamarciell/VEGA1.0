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

# Copy server source code (needs to be compiled or run with tsx/ts-node)
# For now, we'll copy the TypeScript source and use tsx to run it
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/src/api ./src/api

# Copy TypeScript config if needed
COPY --from=builder /app/tsconfig*.json ./

# Install tsx for running TypeScript directly (or use ts-node)
RUN npm install -g tsx

# Expose port 8080 (Google Cloud Run default)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the server
CMD ["tsx", "src/server/index.ts"]
