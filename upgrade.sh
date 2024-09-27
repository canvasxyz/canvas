#!/usr/bin/env bash

# Check if an argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <package-name>"
    exit 1
fi

PACKAGES=$(npm ls $1 --depth 0 | grep -E '@canvas-js/[a-z-]+' -o)
PACKAGE_COUNT=$(echo "$PACKAGES" | wc -l | tr -d ' ')
echo "$1 is a dependency of ${PACKAGE_COUNT} packages:"
echo "$PACKAGES"

# Format the npm install command
WORKSPACE_FLAGS=$(echo "$PACKAGES" | sed 's/^/-w /' | tr '\n' ' ')
INSTALL_COMMAND="npm install $1@latest $WORKSPACE_FLAGS"

# Echo the command and ask for confirmation
echo "Prepared upgrade command:"
echo ""
echo "$INSTALL_COMMAND"
echo ""
echo "Press Enter to execute this command, or Ctrl+C to cancel..."
read

# Execute the command
eval "$INSTALL_COMMAND"
