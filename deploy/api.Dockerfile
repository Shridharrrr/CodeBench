# Build API and Web SPA
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM golang:1.24-alpine AS api-builder
WORKDIR /app
RUN apk add --no-cache git gcc musl-dev
COPY api/go.mod api/go.sum* ./api/
WORKDIR /app/api
RUN go mod download
COPY api/ ./
COPY proto/ /app/proto/
COPY --from=web-builder /app/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/codebench-api ./cmd/codebench-api

FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata wget
COPY --from=api-builder /app/codebench-api /app/codebench-api
COPY problems/ /data/problems/
EXPOSE 8080 4222
ENTRYPOINT ["/app/codebench-api"]
