.PHONY: all build test lint dev integration e2e security clean up down doctor

SHELL := /bin/bash
GO ?= go
CARGO ?= cargo
NPM ?= npm

all: build

build: build-api build-judge build-web

build-api:
	$(GO) build -v -o bin/codebench-api ./api/cmd/codebench-api

build-judge:
	$(CARGO) build --release --manifest-path judge/Cargo.toml

build-web:
	cd web && $(NPM) install && $(NPM) run build

test:
	$(GO) test -v -race ./...

lint:
	$(GO) vet ./...
	$(CARGO) check --manifest-path judge/Cargo.toml

dev:
	./codebench dev

integration:
	$(GO) test -v -tags=integration ./...

e2e:
	@echo "Running end-to-end tests..."
	$(GO) test -v -run TestEndToEndVerticalSlice ./api/internal/integration/...

security:
	@echo "Running security checks..."
	$(GO) vet ./...
	$(CARGO) clippy --manifest-path judge/Cargo.toml -- -D warnings || true

up:
	./codebench up

down:
	./codebench down

doctor:
	./codebench doctor

clean:
	rm -rf bin/ target/ data/ web/dist/
