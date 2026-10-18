FROM rust:1.84-bookworm AS builder
WORKDIR /app
COPY judge/Cargo.toml judge/Cargo.lock* ./judge/
COPY judge/src ./judge/src
WORKDIR /app/judge
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    clang \
    mold \
    libcap2-bin \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/judge/target/release/codebench-judge /usr/local/bin/codebench-judge
RUN mkdir -p /var/cache/codebench /var/run/codebench/slots
ENTRYPOINT ["/usr/local/bin/codebench-judge"]
