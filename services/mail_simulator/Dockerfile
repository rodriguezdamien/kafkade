FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.24.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN pnpm run build

# Start the application
CMD ["pnpm", "start"]
