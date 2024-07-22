#!/usr/bin/env sh

# Uninstall the local development build of the Canvas CLI
# from /usr/bin/dev.

INSTALL_PATH=$(npm config get prefix)/bin/canvas

if test -f "$INSTALL_PATH"; then
    rm ${INSTALL_PATH}
    echo "Uninstalled"
else
    echo "No executable found"
fi
