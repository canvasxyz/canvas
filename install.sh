#!/usr/bin/env sh

INSTALL_PATH=$(npm config get prefix)/bin/canvas
touch ${INSTALL_PATH}
echo "#!/usr/bin/env sh" >> ${INSTALL_PATH}
echo "node ${PWD}/packages/canvas-cli/dist/index.js \$@" >> ${INSTALL_PATH}
chmod +x ${INSTALL_PATH}