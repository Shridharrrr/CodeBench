.PHONY: all build test lint dev integration e2e security clean up down doctor

SHELL := /bin/bash
GO ?= go
CARGO ?= cargo
NPM ?= npm

all: build

build: build-api build-judge build-web

build-api:
	cd api && $(GO) build -v -o ../bin/codebench-api ./cmd/codebench-api

build-judge:
	cd judge && $(CARGO) build --release

build-web:
	cd web && $(NPM) install && $(NPM) run build

test:
	cd api && $(GO) test -v -race ./...

lint:
	cd api && $(GO) vet ./...
	cd judge && $(CARGO) check

dev:
	./codebench dev

integration:
	cd api && $(GO) test -v -tags=integration ./...

e2e:
	@echo "Running end-to-end tests..."
	cd api && $(GO) test -v -run TestEndToEndVerticalSlice ./internal/integration/...

security:
	@echo "Running security checks..."
	cd api && $(GO) vet ./...
	cd judge && $(CARGO) clippy -- -D warnings || true

up:
	./codebench up

down:
	./codebench down

doctor:
	./codebench doctor

clean:
	rm -rf bin/ target/ data/ web/dist/
