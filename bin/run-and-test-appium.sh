#!/usr/bin/env bash

set -v

./node_modules/.bin/appium &
PID=$!

echo "waiting for appium to settle..."
while [[ $(curl -sL -w "%{http_code}" http://127.0.0.1:4723/wd/hub/sessions -o /dev/null) != "200" ]]; do
  sleep 1
done

node bin/test-appium.js
EXIT_CODE=$?

kill -s 2 $PID
wait $PID
exit $EXIT_CODE