INSTALL_PATH=node_modules/.bin/canvas
touch ${INSTALL_PATH}
echo "#!/usr/bin/env sh" >> ${INSTALL_PATH}
echo "node ${PWD}/packages/cli/dist/index.js \$@" >> ${INSTALL_PATH}
chmod +x ${INSTALL_PATH}
echo "Done! Installed CLI to" $INSTALL_PATH

PATH=$INSTALL_PATH:$PATH
