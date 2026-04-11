#!/bin/sh

set -eu

MESSAGE_FILE="${1:-}"

if [ -z "$MESSAGE_FILE" ]; then
  echo "gommage: commit-msg hook requires the commit message file path." >&2
  exit 1
fi

if command -v gommage >/dev/null 2>&1; then
  exec gommage hook "$MESSAGE_FILE"
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SHELL_ENTRY="$SCRIPT_DIR/../shell/gommage.sh"

if [ -x "$SHELL_ENTRY" ]; then
  exec "$SHELL_ENTRY" hook "$MESSAGE_FILE"
fi

echo "gommage: no CLI or shell fallback is available." >&2
exit 1
