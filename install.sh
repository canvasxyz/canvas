#!/usr/bin/env sh

INSTALL_PATH=$(npm config get prefix)/bin/canvas

if test -f "$INSTALL_PATH"; then
    read -p "Already installed. Overwrite any past install? [y/N] " -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        # Overwrite any past install
        echo "#!/usr/bin/env sh" > ${INSTALL_PATH}
    else
        echo
        echo "Aborting, ok!"
        exit 1
    fi
else
    # Create a new install
    touch ${INSTALL_PATH}
    echo "#!/usr/bin/env sh" >> ${INSTALL_PATH}
fi
echo "node ${PWD}/packages/canvas-cli/dist/index.js \$@" >> ${INSTALL_PATH}
chmod +x ${INSTALL_PATH}
echo
echo "Done!"
