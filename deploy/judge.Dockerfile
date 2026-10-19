FROM rust:1.84-bookworm AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY judge/ ./judge/
RUN cargo build --release --manifest-path judge/Cargo.toml

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
COPY --from=builder /app/target/release/codebench-judge /usr/local/bin/codebench-judge
RUN groupadd -g 10001 codebench && useradd -u 10001 -g codebench -s /bin/false codebench \
    && mkdir -p /var/cache/codebench /var/run/codebench/slots /var/run/codebench/work \
    && chown -R 10001:10001 /var/cache/codebench /var/run/codebench
ENTRYPOINT ["/usr/local/bin/codebench-judge"]
