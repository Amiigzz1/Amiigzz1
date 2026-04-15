# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
# Prisma on Alpine requires OpenSSL 3 + libc compat for the native engines.
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable

# --- dev target: mounted source, hot reload ---
FROM base AS dev
COPY package.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# --- build target ---
FROM base AS build
COPY package.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate
COPY . .
RUN npm run build

# --- production runtime ---
FROM node:20-alpine AS prod
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
COPY package.json ./
COPY prisma ./prisma
RUN npm install --omit=dev
RUN npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
