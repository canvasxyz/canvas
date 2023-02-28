VERSION="\"$1\""
SET_VERSION=".version |= ${VERSION}"

echo "$( jq "${SET_VERSION}" package.json )" > package.json

PACKAGES="$(ls packages/)"

for f in ./packages/*/package.json; do
  echo "$( jq "${SET_VERSION}" $f )" > $f;
  for PACKAGE in ${PACKAGES}; do
    P="\"@canvas-js/${PACKAGE}\"";
    SET_DEPENDENCIES="if .dependencies.${P}? then .dependencies.${P} = ${VERSION} else . end";
    SET_DEV_DEPENDENCIES="if .devDependencies.${P}? then .devDependencies.${P} = ${VERSION} else . end";
    echo "$( jq "${SET_DEPENDENCIES} | ${SET_DEV_DEPENDENCIES}" $f)" > $f;
  done;
done

for f in ./examples/*/package.json; do
  echo "$( jq "${SET_VERSION}" $f )" > $f;
  for PACKAGE in ${PACKAGES}; do
    P="\"@canvas-js/${PACKAGE}\"";
    SET_DEPENDENCIES="if .dependencies.${P}? then .dependencies.${P} = ${VERSION} else . end";
    SET_DEV_DEPENDENCIES="if .devDependencies.${P}? then .devDependencies.${P} = ${VERSION} else . end";
    echo "$( jq "${SET_DEPENDENCIES} | ${SET_DEV_DEPENDENCIES}" $f)" > $f;
  done;
done

