# The project's gate and its build. `ops/release.sh` calls `make check` and `make dist` for the box, and the deploy job builds the same target.

SHELL := /bin/bash
.DEFAULT_GOAL := check

BINARY       := credo-audit-backbone
BUILD_COMMIT ?= unknown
# The box is arm64 (t4g.nano). A host build for scripts/smoke.sh overrides both.
DIST_OS      ?= linux
DIST_ARCH    ?= arm64
DIST_DIR     ?= dist

# CGO_ENABLED=0 keeps the binary static: modernc.org/sqlite is pure Go, so no
# toolchain is needed on the box or for the cross-compile.
GO_BUILD := CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.buildVersion=$(BUILD_COMMIT)"

.PHONY: dist
dist: ## The artifact: $(DIST_DIR)/$(BINARY), static, its commit in /health
	GOOS=$(DIST_OS) GOARCH=$(DIST_ARCH) $(GO_BUILD) -o $(DIST_DIR)/$(BINARY) ./cmd/server

# The cross-compile is in the gate: a dependency that quietly needs cgo would
# otherwise surface only at ship time.
.PHONY: check
check: fmt-check vet test ## The gate: format, vet, race tests at 100 % coverage, the box's build
	GOOS=$(DIST_OS) GOARCH=$(DIST_ARCH) $(GO_BUILD) -o /dev/null ./cmd/server

.PHONY: fmt
fmt:
	gofmt -w .

.PHONY: fmt-check
fmt-check:
	@out=$$(gofmt -l .); \
	if [ -n "$$out" ]; then echo "unformatted:"; echo "$$out"; exit 1; fi

.PHONY: vet
vet:
	go vet ./...

.PHONY: test
test:
	./scripts/cover.sh
