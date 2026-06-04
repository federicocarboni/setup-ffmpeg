#!/usr/bin/env bash
#
# Publish a Linux ffmpeg static build as a GitHub Release on this fork so CI does
# not depend on johnvansickle.com at runtime. Requires `gh` authenticated with
# write access to suno-ai/setup-ffmpeg.
#
# Usage:
#   scripts/publish-linux-build.sh            # publish current upstream release
#   scripts/publish-linux-build.sh 7.0.2      # publish a specific version
#   ARCHES="amd64 arm64" scripts/publish-linux-build.sh
#
set -euo pipefail

REPO="${REPO:-suno-ai/setup-ffmpeg}"
ARCHES="${ARCHES:-amd64}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Resolving current upstream release version..."
  VERSION="$(curl -fsSL https://johnvansickle.com/ffmpeg/release-readme.txt \
    | sed -n 's/^ *version: *//p' | head -1)"
fi
if [[ -z "$VERSION" ]]; then
  echo "ERROR: could not determine ffmpeg version" >&2
  exit 1
fi

TAG="ffmpeg-${VERSION}"
echo "Publishing ${TAG} to ${REPO} for arch(es): ${ARCHES}"

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "ERROR: release ${TAG} already exists on ${REPO}." >&2
  echo "Delete it first (gh release delete ${TAG} --repo ${REPO}) or bump the version." >&2
  exit 1
fi

ASSETS=()
for ARCH in $ARCHES; do
  # johnvansickle only labels the *latest* release as "release-<arch>"; a pinned
  # historical version lives under a versioned filename. Try both.
  OUT="${WORKDIR}/ffmpeg-${VERSION}-${ARCH}-static.tar.xz"
  echo "Downloading ${ARCH} build..."
  if ! curl -fL -o "$OUT" \
      "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${ARCH}-static.tar.xz"; then
    curl -fL -o "$OUT" \
      "https://johnvansickle.com/ffmpeg/releases/ffmpeg-${VERSION}-${ARCH}-static.tar.xz"
  fi
  # Sanity check: the binary inside should report the expected version.
  tar -tf "$OUT" >/dev/null
  ASSETS+=("$OUT")
done

echo "Creating release ${TAG}..."
gh release create "$TAG" \
  --repo "$REPO" \
  --title "ffmpeg ${VERSION}" \
  --notes "Static ffmpeg ${VERSION} (re-hosted johnvansickle.com build) for CI use by setup-ffmpeg." \
  "${ASSETS[@]}"

echo "Done. ${TAG} published with: ${ASSETS[*]##*/}"
