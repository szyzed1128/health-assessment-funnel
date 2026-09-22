ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE}

WORKDIR /app

ARG DEBIAN_MIRROR=
ARG DEBIAN_SECURITY_MIRROR=

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://health_user:health_password@postgres:5432/health_assessment?schema=public

RUN if [ -n "$DEBIAN_MIRROR" ]; then \
    sed -i "s|http://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR:-$DEBIAN_MIRROR}|g; s|http://deb.debian.org/debian|${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
  fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npm run db:deploy && npm start"]
