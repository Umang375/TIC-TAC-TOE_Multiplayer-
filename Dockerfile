# Stage 1: Build the Nakama TypeScript module
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY nakama/package.json nakama/package-lock.json* ./
RUN npm install

# Copy source files and build
COPY nakama/src ./src
COPY nakama/tsconfig.json ./
COPY nakama/rollup.config.mjs ./
RUN npx rollup -c

# Stage 2: Nakama runtime with custom module
FROM heroiclabs/nakama:3.24.2

# Copy the built module into Nakama's modules directory
COPY --from=builder /app/build/index.js /nakama/data/modules/build/index.js

# Copy Nakama configuration
COPY nakama/local.yml /nakama/data/local.yml
