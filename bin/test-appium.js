'use strict';

var Promise = require('bluebird');
var wd = require('wd');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var path = require('path');
var find = require('lodash.find');
var reporter = require('./test-reporter');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

var ANDROID_PATH = './test/platforms/android/build/outputs/apk/android-debug.apk';
var IOS_PATH = './test/platforms/ios/build/emulator/SQLitePlugin2.app';
var MAX_NUM_TRIES = 50;
var RETRY_TIMEOUT = 5000;
var WAIT_TIMEOUT = 3000;
var PLATFORM = process.env.ANDROID ? 'android' : 'ios';

var app;
var desired;

if (PLATFORM === 'android') {
  app = path.resolve(ANDROID_PATH);
  desired = {
    platformName: 'Android',
    deviceName: 'foobar',
    app: app,
    'app-package': 'com.nolanlawson.cordova.sqlite.test',
    'app-activity': 'MainActivity'
  };
} else { // ios
  app = path.resolve(IOS_PATH);
  desired = {
    platformName: 'iOS',
    deviceName: 'iPhone Simulator',
    platformVersion: '9.1',
    app: app
  };
}


var driver = wd.promiseChainRemote('0.0.0.0', 4723);
var browser = driver.init(desired);

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function runTest() {
  return browser.setImplicitWaitTimeout(WAIT_TIMEOUT).then(function () {
    return wait(RETRY_TIMEOUT);
  }).then(function () {
    return browser.contexts();
  }).then(function (contexts) {
    var webViewContext = find(contexts, function (context) {
      return context.indexOf('WEBVIEW') !== -1;
    });
    return driver.context(webViewContext);
  }).then(waitForZuul);
}

var failures = 0;
var numTries = 0;

function waitForZuul() {
  console.log('pinging zuul, try #' + (numTries + 1) + '...');
  var script = 'window.zuul_msg_bus ? ' +
    'window.zuul_msg_bus.splice(0, window.zuul_msg_bus.length) : ' +
    '[]';

  return browser.eval(script).then(function (messages) {
    if (!messages.length) {
      numTries++;
      if (numTries === MAX_NUM_TRIES) {
        throw new Error('timeout after ' + MAX_NUM_TRIES + ' tries');
      }
    } else {
      numTries = 0;
    }
    messages.forEach(function (message) {
      if (message.type === 'test_end' && !message.passed) {
        failures++;
      }
      reporter.emit(message.type, message);
    });
    var doneMessage = find(messages, function (message) {
        return message.type === 'done';
    });
    if (failures > 0) {
      throw new Error('there were failing tests');
    }
    if (doneMessage) {
      return;
    } else {
      return wait(RETRY_TIMEOUT)
        .then(waitForZuul);
    }
  });
}

console.log('running tests on platform: ' + PLATFORM);
runTest().then(function () {
  console.log('done!');
  process.exit(0);
}).catch(function (err) {
  console.log(err.stack);
  process.exit(1);
});
