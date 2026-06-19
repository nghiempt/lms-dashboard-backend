# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---------- Production dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ---------- Runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/prisma        ./prisma
COPY package*.json ./
EXPOSE 4000
# Chạy migrate trước rồi start app. Bỏ "prisma migrate deploy &&" nếu bạn
# muốn migrate thủ công.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
