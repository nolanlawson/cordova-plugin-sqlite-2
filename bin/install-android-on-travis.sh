#!/usr/bin/env bash

if [[ $PLATFORM != 'android' ]]; then
  exit 0
fi

brew install android
( sleep 5 && while [ 1 ]; do sleep 1; echo y; done ) | /usr/local/bin/android update \
  sdk --no-ui --all --filter platform-tool,android-23,build-tools-23.0.3