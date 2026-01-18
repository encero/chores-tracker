# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
# Note: VITE_CONVEX_URL is NOT set here - it will be provided at runtime
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 app

# Copy built application from builder
COPY --from=builder --chown=app:nodejs /app/.output /app/.output

# Switch to non-root user
USER app

# Expose port
EXPOSE 3000

# Set default environment variables
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application
# VITE_CONVEX_URL must be provided at runtime via docker-compose or docker run -e
CMD ["node", ".output/server/index.mjs"]
