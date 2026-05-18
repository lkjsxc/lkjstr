FROM node:24-bookworm-slim AS deps

WORKDIR /app
RUN npm install --global pnpm@11.1.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM deps AS app
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM deps AS verify
CMD ["pnpm", "verify"]

FROM deps AS e2e
RUN pnpm exec playwright install --with-deps chromium
CMD ["pnpm", "test:e2e"]
