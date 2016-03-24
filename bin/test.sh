#!/usr/bin/env bash

set -e

CORDOVA=$(pwd)/node_modules/.bin/cordova

npm run build
cd test
bash -c "$CORDOVA plugin rm cordova-plugin-sqlite-2 >/dev/null 2>/dev/null; exit 0"
bash -c "$CORDOVA platform rm android >/dev/null 2>/dev/null; exit 0"

$CORDOVA platform add android
$CORDOVA plugin add ..
$CORDOVA run android