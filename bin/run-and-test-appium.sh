#!/usr/bin/env bash

set -v

./node_modules/.bin/appium &
PID=$!

echo "waiting for appium to settle..."
sleep 5

node bin/test-appium.js
EXIT_CODE=$?

kill -s 2 $PID
wait $PID
exit $EXIT_CODE