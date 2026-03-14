FROM node:20-slim

WORKDIR /app

# Issue: apt-get without --no-install-recommends
RUN apt-get update && apt-get install -y python3 python3-pip

# Issue: pip without --no-cache-dir
RUN pip3 install cbrapi

# Issue: COPY . . copies everything
COPY . .

# Issue: npm ci without --omit=dev
RUN npm ci

# Issue: Prisma CLI not removed
RUN npx prisma generate

# Issue: User created after COPY
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs nodejs
RUN chown -R nodejs:nodejs /app

# Issue: Too many layers (consecutive RUN)
RUN echo "layer 1"
RUN echo "layer 2"
RUN echo "layer 3"

CMD ["node", "src/index.js"]
