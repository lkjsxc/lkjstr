FROM node:24-bookworm-slim AS deps

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    clang \
    curl \
    libssl-dev \
    lld \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@11.1.2
ENV PATH="/root/.cargo/bin:${PATH}"
COPY rust-toolchain.toml ./
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
  | sh -s -- -y --profile minimal --default-toolchain none
RUN rustup show
RUN cargo install trunk --locked --version 0.21.14 \
  && cargo install wasm-pack --locked --version 0.15.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .

FROM deps AS verify
CMD ["cargo", "run", "-p", "lkjstr-xtask", "--", "quiet", "docker-verify"]

FROM deps AS app-build
RUN pnpm build

FROM app-build AS app
EXPOSE 5173
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "5173"]

FROM app AS app-smoke
CMD ["pnpm", "exec", "tsx", "scripts/app-smoke.ts"]

FROM app-build AS cloudflare
CMD ["pnpm", "cloudflare:dry-run:built"]
