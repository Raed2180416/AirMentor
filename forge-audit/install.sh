#!/usr/bin/env bash
# install-forge-audit.sh — Global installer for forge-audit
# Installs forge-audit into a dedicated venv at ~/.forge-audit and links the binary
set -euo pipefail

INSTALL_DIR="$HOME/.forge-audit"
VENV="$INSTALL_DIR/venv"
BIN_LINK="$HOME/.local/bin/forge-audit"

echo "=== forge-audit global installer ==="
echo ""

# Ensure ~/.local/bin exists
mkdir -p "$HOME/.local/bin"

# Create venv if needed
if [ ! -d "$VENV" ]; then
    echo "Creating virtual environment at $VENV..."
    python3 -m venv "$VENV"
fi

# Install/upgrade pip
"$VENV/bin/pip" install --upgrade pip -q

# Install forge-audit and dependencies
echo "Installing forge-audit and dependencies..."
"$VENV/bin/pip" install -e "$(dirname "$(readlink -f "$0")")" -q

# Install language grammars
echo "Installing Tree-sitter language grammars..."
"$VENV/bin/pip" install -q \
    tree-sitter-python \
    tree-sitter-typescript \
    tree-sitter-javascript \
    tree-sitter-go \
    tree-sitter-rust \
    tree-sitter-bash \
    tree-sitter-c \
    tree-sitter-sql \
    tree-sitter-json \
    tree-sitter-yaml \
    tree-sitter-html \
    tree-sitter-css 2>/dev/null || true

# Create symlink
ln -sf "$VENV/bin/forge-audit" "$BIN_LINK"

echo ""
echo "=== Installation complete ==="
echo "forge-audit is now available at: $BIN_LINK"
echo ""
echo "Make sure $HOME/.local/bin is in your PATH."
echo "If not, add this to your ~/.zshrc or ~/.bashrc:"
echo '  export PATH="$HOME/.local/bin:$PATH"'
echo ""
echo "Usage:"
echo "  forge-audit audit /path/to/project"
echo "  forge-audit audit . --llm          # With LLM deep analysis"
echo "  forge-audit status"
echo "  forge-audit query \"search term\""
echo "  forge-audit blast-radius path/to/file.ts"
