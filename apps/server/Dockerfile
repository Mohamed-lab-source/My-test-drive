# Build context is this directory (apps/server), not the repo root, e.g.:
#   cd apps/server && docker build -t cookmate-api .
# Most PaaS Dockerfile deploys (Railway, Render, Fly) let you set a
# "root directory" to apps/server, which does this automatically.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
