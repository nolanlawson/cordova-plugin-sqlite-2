#!/usr/bin/env bash

set -e

CORDOVA=$(pwd)/node_modules/.bin/cordova
ZUUL=$(pwd)/node_modules/.bin/zuul
REPLACE=$(pwd)/node_modules/.bin/replace

npm run build

$ZUUL --ui mocha-bdd --local 9494 --no-coverage test/test.js &
ZUUL_PID=$!

cd test

if [[ -z $SKIP_CLEAN ]]; then
  bash -c "$CORDOVA plugin rm cordova-plugin-sqlite-2 >/dev/null 2>/dev/null; exit 0"
  bash -c "$CORDOVA platform rm android >/dev/null 2>/dev/null; exit 0"

  $CORDOVA platform add android
  $CORDOVA plugin add ..
fi

ZUUL_ROOT="http://127.0.0.1:9494"
while [[ $(curl -sL -w "%{http_code}" "$ZUUL_ROOT"/__zuul/test-bundle.js -o /dev/null) != "200" ]]; do
  sleep 1
done

curl -sL "$ZUUL_ROOT"/__zuul/framework.js > www/zuul-framework.js
curl -sL "$ZUUL_ROOT"/__zuul/client.js > www/zuul-client.js
curl -sL "$ZUUL_ROOT"/__zuul/test-bundle.js > www/test-bundle.js
curl -sL "$ZUUL_ROOT"/__zuul/test-bundle.map.json > www/test-bundle.map.json
curl -sL "$ZUUL_ROOT"/__zuul/zuul.css > www/zuul.css
curl -sL "$ZUUL_ROOT"/__zuul/hljs-monokai.css > www/hljs-monokai.css

$REPLACE '/__zuul' '.' www/zuul-client.js

kill $ZUUL_PID

$CORDOVA run android