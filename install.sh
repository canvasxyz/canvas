#!/usr/bin/env sh

INSTALL_PATH=$(npm config get prefix)/bin/canvas
rm -f ${INSTALL_PATH}
touch ${INSTALL_PATH}
echo "#!/usr/bin/env sh" >> ${INSTALL_PATH}
echo "node ${PWD}/packages/canvas-cli/index.js \$@" >> ${INSTALL_PATH}
chmod +x ${INSTALL_PATH}