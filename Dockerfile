# Multi-stage production build for Spendly API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies across workspaces
RUN npm ci

# Copy server code
COPY server/ ./server/

# Compile TypeScript
RUN npm run build:server

# Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy root and server package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install only production dependencies
RUN npm ci --omit=dev --workspace=server

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/server/dist ./server/dist

EXPOSE 4000

USER node

CMD ["npm", "run", "start:server"]
