#!/usr/bin/env bash

if [[ $PLATFORM != 'android' ]]; then
  exit 0
fi

brew tap caskroom/cask
brew cask install android-sdk
( sleep 5 && while [ 1 ]; do sleep 1; echo y; done ) | /usr/local/bin/sdkmanager \
  "platform-tools" "platforms;android-23" "build-tools;26.0.3"

brew install gradle