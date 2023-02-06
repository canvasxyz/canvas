SET_VERSION=".version |= \"$1\""
MAP_DEPENDENCIES="(to_entries | map({ key: .key, value: (if (.key | startswith(\"@canvas-js/\")) then \"$1\" else .value end) }) | from_entries)"
SET_DEPENDENCIES=".dependencies |= ${MAP_DEPENDENCIES}"
SET_DEV_DEPENDENCIES=".devDependencies |= ${MAP_DEPENDENCIES}"

cat package.json | jq "$SET_VERSION" > package.json-v$1
mv package.json-v$1 package.json

for f in ./packages/*/package.json; do cat $f | jq "$SET_VERSION | $SET_DEPENDENCIES | $SET_DEV_DEPENDENCIES" > $f-v$1; mv $f-v$1 $f; done
for f in ./examples/*/package.json; do cat $f | jq "$SET_VERSION | $SET_DEPENDENCIES | $SET_DEV_DEPENDENCIES" > $f-v$1; mv $f-v$1 $f; done

npm install
