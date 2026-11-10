# The project's gate. `make check` is all of it.

SHELL := /bin/bash
.DEFAULT_GOAL := check

# The box is arm64 (t4g.nano), and the BFF reaches it on a private address.
BOX_OS   := linux
BOX_ARCH := arm64

# CGO_ENABLED=0 keeps the binary static: modernc.org/sqlite is pure Go, so no
# toolchain is needed on the box or for the cross-compile.
GO_BUILD := CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"

# make box stamps this variable with the commit (-X); see internal/server.BuildVersion.
STAMP_VAR := credo/c-storage/internal/server.BuildVersion

# The cross-compile is in the gate: a dependency that quietly needs cgo would
# otherwise surface only when the box gets its binary.
.PHONY: check
check: fmt-check vet test ## The gate: format, vet, race tests at 100 % coverage, the box's build
	GOOS=$(BOX_OS) GOARCH=$(BOX_ARCH) $(GO_BUILD) -o /dev/null ./cmd/server

# The box's binary: the gate's cross-compile flags, stamped with the commit it is built
# from, in dist/c-storage. It refuses a tree with uncommitted changes (git lists the whole
# repository from here), so a stamp always names its source, and a stamp is never "dev".
.PHONY: box
box:
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "make box: uncommitted changes; commit them first, so the stamp names the code" >&2; exit 1; fi
	GOOS=$(BOX_OS) GOARCH=$(BOX_ARCH) CGO_ENABLED=0 go build -trimpath \
		-ldflags="-s -w -X $(STAMP_VAR)=$$(git rev-parse HEAD)" -o dist/c-storage ./cmd/server

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
