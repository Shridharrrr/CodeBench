# Build API and Web SPA
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM golang:alpine AS api-builder
WORKDIR /app
RUN apk add --no-cache git gcc musl-dev
COPY go.mod go.sum* ./
RUN go mod download
COPY api/ ./api/
COPY cli/ ./cli/
COPY pkg/ ./pkg/
COPY proto/ ./proto/
COPY --from=web-builder /app/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/codebench-api ./api/cmd/codebench-api

FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata wget \
    && addgroup -g 10001 -S codebench \
    && adduser -u 10001 -S codebench -G codebench \
    && mkdir -p /data/problems /data/nats \
    && chown -R 10001:10001 /app /data
COPY --from=api-builder --chown=10001:10001 /app/codebench-api /app/codebench-api
COPY --from=web-builder --chown=10001:10001 /app/web/dist /app/web/dist
COPY --chown=10001:10001 problems/ /app/problems/
COPY --chown=10001:10001 problems/ /data/problems/
USER 10001:10001
EXPOSE 8080 4222
ENTRYPOINT ["/app/codebench-api"]
