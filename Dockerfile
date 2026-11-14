# Image-based gates. Nothing mounts the source tree.
FROM rust:1-bookworm AS deps
WORKDIR /app
COPY rust-toolchain.toml ./
RUN rustup show && rustup component add clippy rustfmt \
  && rustup target add wasm32-unknown-unknown
RUN cargo install trunk --locked --version 0.21.14
COPY . .
ENV CARGO_BUILD_JOBS=4

# Full gate: repo checks, fmt, clippy (native and wasm), tests, release build, dist check.
FROM deps AS verify
CMD ["cargo", "run", "-q", "-p", "lkjstr-xtask", "--", "quiet", "docker-verify"]

FROM deps AS app-build
RUN trunk build --release && cargo run -q -p lkjstr-xtask -- check-dist

# Static preview of the built app (development only; no deployment target here).
FROM busybox:1.36 AS app
COPY --from=app-build /app/dist /www
EXPOSE 8080
CMD ["httpd", "-f", "-v", "-p", "8080", "-h", "/www"]
