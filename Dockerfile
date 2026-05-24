FROM node:24-bookworm-slim AS deps

WORKDIR /app
RUN npm install --global pnpm@11.1.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM deps AS app
RUN pnpm build
EXPOSE 5173
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "5173"]

FROM deps AS verify
CMD ["pnpm", "verify:quiet"]

FROM deps AS cloudflare
CMD ["pnpm", "cloudflare:dry-run"]

FROM deps AS e2e
RUN pnpm exec playwright install --with-deps chromium
CMD ["pnpm", "test:e2e:quiet"]
