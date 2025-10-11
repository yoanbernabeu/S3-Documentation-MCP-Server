# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install build dependencies and runtime libraries for native modules
RUN apk add --no-cache python3 make g++ libstdc++

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Clean up build tools (keep runtime libraries)
RUN apk del python3 make g++

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create data directory for vector store
RUN mkdir -p /app/data/hnswlib-store

# Expose port
EXPOSE 3000

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Start the application
CMD ["node", "dist/index.js"]

