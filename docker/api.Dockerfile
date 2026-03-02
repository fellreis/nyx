FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @nyx/api...

COPY tsconfig.base.json .
COPY apps/api ./apps/api

WORKDIR /app/apps/api

RUN pnpm prisma:generate
RUN pnpm build

EXPOSE 4000
CMD ["sh", "-c", "if [ ! -f dist/index.js ]; then pnpm prisma:generate && pnpm build; fi; pnpm prisma:deploy && pnpm start"]
