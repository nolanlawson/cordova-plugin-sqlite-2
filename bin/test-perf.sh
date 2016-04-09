#!/usr/bin/env bash

: ${PLATFORM:="android"}
: ${WKWEBVIEW:="0"}
: ${RUN:="1"}
: ${WEBSQL:="0"}
: ${CROSSWALK:="0"}
: ${OLD_SQLITE_PLUGIN:="0"}

set -e
set -v

CORDOVA=$(pwd)/node_modules/.bin/cordova
BROWSERIFY=$(pwd)/node_modules/.bin/browserify

npm run build

$BROWSERIFY perf/www/index.js > perf/www/bundle.js

cd perf

bash -c "$CORDOVA plugin rm cordova-plugin-sqlite-2 >/dev/null 2>/dev/null; exit 0"
bash -c "$CORDOVA plugin rm cordova-plugin-wkwebview-engine >/dev/null 2>/dev/null; exit 0"
bash -c "$CORDOVA plugin rm cordova-plugin-crosswalk-webview >/dev/null 2>/dev/null; exit 0"
bash -c "$CORDOVA plugin rm cordova-sqlite-storage >/dev/null 2>/dev/null; exit 0"
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
  if [[ $OLD_SQLITE_PLUGIN == '0' ]]; then
    $CORDOVA plugin add ..
  else
    $CORDOVA plugin add https://github.com/litehelpers/Cordova-sqlite-storage
  fi
fi

if [[ $RUN == '1' ]]; then
  $CORDOVA run $PLATFORM
else
  $CORDOVA build $PLATFORM
fi
