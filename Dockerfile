# One browser product: TypeScript interface plus the real Rust/WASM Worker.
FROM node:24-bookworm AS node
FROM rust:1-bookworm AS deps
COPY --from=node /usr/local/ /usr/local/
WORKDIR /app
COPY rust-toolchain.toml ./
RUN rustup show && rustup component add clippy rustfmt \
  && rustup target add wasm32-unknown-unknown
RUN npm install -g pnpm@11.1.2 \
  && cargo install wasm-bindgen-cli --locked --version 0.2.122
COPY . .
ENV CARGO_BUILD_JOBS=4 RUST_TEST_THREADS=4 \
  LKJSTR_WASM_BINDGEN=/usr/local/cargo/bin/wasm-bindgen
RUN pnpm install --frozen-lockfile --store-dir /app/tmp/pnpm-store \
  && pnpm --dir web install --frozen-lockfile --store-dir /app/tmp/pnpm-store

FROM deps AS verify
CMD ["cargo", "run", "-q", "-p", "lkjstr-xtask", "--", "quiet", "docker-verify"]

FROM deps AS app-build
RUN pnpm build

FROM busybox:1.36 AS app
COPY --from=app-build /app/dist /www
EXPOSE 8080
CMD ["httpd", "-f", "-v", "-p", "8080", "-h", "/www"]
