if [[ $1 == v* ]]; then
  echo "invalid version number" && exit 1
fi

VERSION="\"$1\""
SET_VERSION=".version |= ${VERSION}"


echo "$( jq "${SET_VERSION}" package.json )" > package.json

PACKAGES="$(ls packages/)"

for f in ./packages/*/package.json; do
  p=$( cat $f | jq "${SET_VERSION}" )
  for PACKAGE in ${PACKAGES}; do
    P="\"@canvas-js/${PACKAGE}\"";
    SET_DEPENDENCIES="if .dependencies.${P}? then .dependencies.${P} = ${VERSION} else . end";
    SET_DEV_DEPENDENCIES="if .devDependencies.${P}? then .devDependencies.${P} = ${VERSION} else . end";
    p=$( echo $p | jq "${SET_DEPENDENCIES} | ${SET_DEV_DEPENDENCIES}" );
  done;
  echo $p | jq > $f;
done

for f in ./examples/*/package.json; do
  p=$( cat $f | jq "${SET_VERSION}" )
  for PACKAGE in ${PACKAGES}; do
    P="\"@canvas-js/${PACKAGE}\"";
    SET_DEPENDENCIES="if .dependencies.${P}? then .dependencies.${P} = ${VERSION} else . end";
    SET_DEV_DEPENDENCIES="if .devDependencies.${P}? then .devDependencies.${P} = ${VERSION} else . end";
    p=$( echo $p | jq "${SET_DEPENDENCIES} | ${SET_DEV_DEPENDENCIES}" );
  done;
  echo $p | jq > $f;
done

rm package-lock.json
npm i