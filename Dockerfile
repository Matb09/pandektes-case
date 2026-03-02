# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_node_modules && \
    npm ci

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001 -G nestjs

COPY --from=deps /prod_node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

USER nestjs
EXPOSE 3000

CMD ["node", "dist/main.js"]
