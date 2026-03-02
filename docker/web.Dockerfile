FROM node:20-alpine

WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter ./apps/web...

COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN pnpm build
COPY docker/web-entrypoint.sh /usr/local/bin/web-entrypoint.sh
RUN chmod +x /usr/local/bin/web-entrypoint.sh
EXPOSE 3000
CMD ["/usr/local/bin/web-entrypoint.sh"]
