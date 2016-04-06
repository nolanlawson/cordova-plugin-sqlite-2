#!/usr/bin/env bash

: ${PLATFORM:="android"}
: ${WKWEBVIEW:="0"}
: ${CLEAN:="1"}
: ${RUN:="1"}
: ${WEBSQL:="0"}
: ${CROSSWALK:="0"}

set -e
set -v

CORDOVA=$(pwd)/node_modules/.bin/cordova
ZUUL=$(pwd)/node_modules/.bin/zuul
REPLACE=$(pwd)/node_modules/.bin/replace

npm run build

$ZUUL --ui mocha-bdd --local 9494 --no-coverage test/test.js &
ZUUL_PID=$!

cd test

if [[ $CLEAN == '1' ]]; then
  bash -c "$CORDOVA plugin rm cordova-plugin-sqlite-2 >/dev/null 2>/dev/null; exit 0"
  bash -c "$CORDOVA plugin rm cordova-plugin-wkwebview-engine >/dev/null 2>/dev/null; exit 0"
  bash -c "$CORDOVA plugin rm cordova-plugin-crosswalk-webview >/dev/null 2>/dev/null; exit 0"
  bash -c "$CORDOVA platform rm android >/dev/null 2>/dev/null; exit 0"
  bash -c "$CORDOVA platform rm ios >/dev/null 2>/dev/null; exit 0"
  if [[ $PLATFORM == 'ios' ]]; then
    if [[ $WKWEBVIEW == '1' ]]; then
      $CORDOVA platform add ios@4.0.0
      $CORDOVA plugin add cordova-plugin-wkwebview-engine
    else
      $CORDOVA platform add ios
    fi
  else
    if [[ $CROSSWALK == '1' ]]; then
      $CORDOVA plugin add cordova-plugin-crosswalk-webview
    fi
    $CORDOVA platform add android
  fi
  if [[ $WEBSQL == '0' ]]; then
    $CORDOVA plugin add ..
  fi
fi

ZUUL_ROOT="http://127.0.0.1:9494"
while [[ $(curl -sL -w "%{http_code}" "$ZUUL_ROOT"/__zuul/test-bundle.js -o /dev/null) != "200" ]]; do
  sleep 1
done

curl -sL "$ZUUL_ROOT"/__zuul/framework.js > www/zuul-framework.js
curl -sL "$ZUUL_ROOT"/__zuul/client.js > www/zuul-client.js
curl -sL "$ZUUL_ROOT"/__zuul/test-bundle.js > www/test-bundle.js
curl -sL "$ZUUL_ROOT"/__zuul/zuul.css > www/zuul.css
curl -sL "$ZUUL_ROOT"/__zuul/hljs-monokai.css > www/hljs-monokai.css

$REPLACE '/__zuul' '.' www/zuul-client.js

kill $ZUUL_PID

if [[ $RUN == '1' ]]; then
  $CORDOVA run $PLATFORM
else
  $CORDOVA build $PLATFORM
fi

if [[ $PLATFORM == 'ios' ]]; then
  # zip up for upload to appium
  cd platforms/ios/build/emulator
  zip -r SQLitePlugin2.app.zip SQLitePlugin2.app
fi
