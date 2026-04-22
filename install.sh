#!/bin/sh
# Handoff CLI installer
#
#   curl -fsSL https://raw.githubusercontent.com/jtljrdn/handoff-env/main/install.sh | sh
#
# Environment variables:
#   HANDOFF_VERSION      Release tag to install (default: latest).  e.g. v0.1.0
#   HANDOFF_INSTALL_DIR  Where to drop the binary (default: $HOME/.local/bin).
#   HANDOFF_REPO         Source repo (default: jtljrdn/handoff-env).

set -eu

REPO="${HANDOFF_REPO:-jtljrdn/handoff-env}"
VERSION="${HANDOFF_VERSION:-latest}"
INSTALL_DIR="${HANDOFF_INSTALL_DIR:-$HOME/.local/bin}"

uname_s=$(uname -s 2>/dev/null || echo unknown)
uname_m=$(uname -m 2>/dev/null || echo unknown)

case "$uname_s" in
  Darwin) os=darwin ;;
  Linux)  os=linux ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "On Windows use the .exe from https://github.com/$REPO/releases/latest or install via 'npx handoff-env'." >&2
    exit 1
    ;;
  *)
    echo "Unsupported OS: $uname_s" >&2
    exit 1
    ;;
esac

case "$uname_m" in
  arm64|aarch64) arch=arm64 ;;
  x86_64|amd64)  arch=x64 ;;
  *)
    echo "Unsupported architecture: $uname_m" >&2
    exit 1
    ;;
esac

asset="handoff-${os}-${arch}"

if [ "$VERSION" = "latest" ]; then
  url="https://github.com/${REPO}/releases/latest/download/${asset}"
else
  url="https://github.com/${REPO}/releases/download/${VERSION}/${asset}"
fi

mkdir -p "$INSTALL_DIR"
target="$INSTALL_DIR/handoff"
tmp="$(mktemp)"

printf 'Downloading %s (%s)...\n' "$asset" "$VERSION"

if command -v curl >/dev/null 2>&1; then
  if ! curl --fail --silent --show-error --location "$url" -o "$tmp"; then
    rm -f "$tmp"
    echo "Download failed: $url" >&2
    exit 1
  fi
elif command -v wget >/dev/null 2>&1; then
  if ! wget --quiet "$url" -O "$tmp"; then
    rm -f "$tmp"
    echo "Download failed: $url" >&2
    exit 1
  fi
else
  rm -f "$tmp"
  echo "Need curl or wget to download the binary." >&2
  exit 1
fi

# Quick sanity check: a binary is larger than a 404 HTML page.
size=$(wc -c < "$tmp" | tr -d ' ')
if [ "$size" -lt 1000000 ]; then
  echo "Downloaded file is only ${size} bytes; likely a 404 or redirect." >&2
  echo "Check $url" >&2
  rm -f "$tmp"
  exit 1
fi

mv "$tmp" "$target"
chmod 755 "$target"

echo
echo "Installed: $target"

# PATH hint
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    printf '\nAdd it to your PATH by appending this line to your shell rc:\n'
    printf '  export PATH="%s:$PATH"\n' "$INSTALL_DIR"
    ;;
esac

printf '\n'
"$target" --version
