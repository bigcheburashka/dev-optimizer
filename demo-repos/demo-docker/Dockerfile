# Demo 1: Docker Optimization
# This Dockerfile has many anti-patterns for demo purposes

FROM ubuntu:latest

# Anti-pattern 1: Large base image
# Anti-pattern 2: No multistage build

RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    curl \
    git \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Anti-pattern 3: Missing .dockerignore (file doesn't exist)

# Anti-pattern 4: Copy everything (builds context too large)
COPY . .

# Anti-pattern 5: Install all dependencies (including dev)
RUN npm install

# Anti-pattern 6: Multiple RUN commands (too many layers)
RUN npm run build
RUN npm run lint
RUN npm run test

# Anti-pattern 7: No cleanup after install
# Anti-pattern 8: Running as root

EXPOSE 3000

CMD ["npm", "start"]