# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY . .

# Build the application
# Note: VITE_CONVEX_URL is NOT set here - it will be provided at runtime
RUN bun run build

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 app -G appgroup

# Copy built application from builder
COPY --from=builder --chown=app:appgroup /app/.output /app/.output

# Switch to non-root user
USER app

# Expose port
EXPOSE 3000

# Set default environment variables
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application
# VITE_CONVEX_URL must be provided at runtime via docker-compose or docker run -e
CMD ["bun", "run", ".output/server/index.mjs"]
