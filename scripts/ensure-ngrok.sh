#!/usr/bin/env sh
set -eu

DEFAULT_INSTALL_DIR="${HOME:-}/.local/bin"
INSTALL_DIR="${NGROK_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
BASE_URL="https://bin.equinox.io/c/bNyj1mQVY4c"

usage() {
	cat <<'EOF'
Usage:
  scripts/ensure-ngrok.sh

Environment:
  NGROK_INSTALL_DIR=/custom/bin  Install directory. Defaults to ~/.local/bin.
  NGROK_AUTHTOKEN=token          Optional token to configure after installation.

This script installs the ngrok agent only when no usable ngrok binary exists.
It never uses sudo; the default install location is the current user's home.
EOF
}

log() {
	printf '%s\n' "$*" >&2
}

fail() {
	log "Error: $*"
	exit 1
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
	usage
	exit 0
fi

if command -v ngrok >/dev/null 2>&1; then
	command -v ngrok
	exit 0
fi

if [ -z "$INSTALL_DIR" ] || [ "$INSTALL_DIR" = "/.local/bin" ]; then
	fail "HOME is not set. Set NGROK_INSTALL_DIR to a writable directory and retry."
fi

TARGET="$INSTALL_DIR/ngrok"

if [ -x "$TARGET" ]; then
	printf '%s\n' "$TARGET"
	exit 0
fi

case "$(uname -s)" in
	Linux)
		OS="linux"
		ARCHIVE_EXT="tgz"
		;;
	Darwin)
		OS="darwin"
		ARCHIVE_EXT="zip"
		;;
	*)
		fail "Unsupported OS: $(uname -s). Install ngrok manually from https://ngrok.com/download."
		;;
esac

case "$(uname -m)" in
	x86_64|amd64)
		ARCH="amd64"
		;;
	aarch64|arm64)
		ARCH="arm64"
		;;
	armv7l|armv6l)
		ARCH="arm"
		;;
	*)
		fail "Unsupported CPU architecture: $(uname -m). Install ngrok manually from https://ngrok.com/download."
		;;
esac

DOWNLOAD_URL="$BASE_URL/ngrok-v3-stable-$OS-$ARCH.$ARCHIVE_EXT"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ngrok-install.XXXXXX")"
ARCHIVE_PATH="$TMP_DIR/ngrok.$ARCHIVE_EXT"

cleanup() {
	rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$INSTALL_DIR"

log "ngrok is not installed. Downloading $DOWNLOAD_URL"

if command -v curl >/dev/null 2>&1; then
	curl -fsSL "$DOWNLOAD_URL" -o "$ARCHIVE_PATH"
elif command -v wget >/dev/null 2>&1; then
	wget -q "$DOWNLOAD_URL" -O "$ARCHIVE_PATH"
else
	fail "curl or wget is required to download ngrok."
fi

case "$ARCHIVE_EXT" in
	tgz)
		tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"
		;;
	zip)
		if command -v unzip >/dev/null 2>&1; then
			unzip -q "$ARCHIVE_PATH" -d "$TMP_DIR"
		else
			tar -xf "$ARCHIVE_PATH" -C "$TMP_DIR" 2>/dev/null || fail "unzip is required to extract ngrok."
		fi
		;;
esac

if [ ! -f "$TMP_DIR/ngrok" ]; then
	fail "Downloaded archive did not contain an ngrok binary."
fi

cp "$TMP_DIR/ngrok" "$TARGET"
chmod 755 "$TARGET"

if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
	"$TARGET" config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null
	log "Configured ngrok authtoken from NGROK_AUTHTOKEN."
else
	log "Installed ngrok at $TARGET"
	log "If this is your first ngrok install, run: $TARGET config add-authtoken <token>"
fi

case ":${PATH:-}:" in
	*":$INSTALL_DIR:"*) ;;
	*) log "Add $INSTALL_DIR to PATH if you want to run ngrok directly." ;;
esac

printf '%s\n' "$TARGET"
