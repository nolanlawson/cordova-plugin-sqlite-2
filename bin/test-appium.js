'use strict';

var Promise = require('bluebird');
var wd = require('wd');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var path = require('path');
var find = require('lodash.find');
var sauceConnectLauncher = require('sauce-connect-launcher');
var reporter = require('./test-reporter');
var request = require('request-promise');
var denodeify = require('denodeify');
var fs = require('fs');
var readFile = denodeify(fs.readFile);
var uuid = require('uuid');
var zlib = require('zlib');
var zip = zlib.createDeflate();
var zipdir = denodeify(require('zip-dir'));

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

var ANDROID_PATH = './test/platforms/android/build/outputs/apk/android-debug.apk';
var IOS_PATH = './test/platforms/ios/build/emulator/SQLitePlugin2.app';
var MAX_NUM_TRIES = 100;
var RETRY_TIMEOUT = 5000;
var WAIT_TIMEOUT = 3000;
var PLATFORM = process.env.PLATFORM || 'android';

var username = process.env.SAUCE_USERNAME;
var accessKey = process.env.SAUCE_ACCESS_KEY;

var app;
var desired;

function configureAndroid() {
  app = path.resolve(ANDROID_PATH);
  desired = {
    platformName: 'Android',
    deviceName: 'foobar',
    'app-package': 'com.nolanlawson.cordova.sqlite.test',
    'app-activity': 'MainActivity',
    app: app
  };
  if (process.env.TRAVIS) {
    desired.platformVersion = process.env.PLATFORM_VERSION;
    // via https://wiki.saucelabs.com/display/DOCS/Platform+Configurator
    desired.browserName = '';
    desired.appiumVersion = '1.5.1';
    desired.deviceName = 'Android Emulator';
    desired.deviceType = 'phone';
    desired.deviceOrientation = 'portrait';
  }
}

function configureIos() {
  app = path.resolve(IOS_PATH);
  desired = {
    platformName: 'iOS',
    deviceName: 'iPhone Simulator',
    platformVersion: '9.1',
    app: app
  };
  if (process.env.TRAVIS) {
    desired.platformVersion = process.env.PLATFORM_VERSION;
    // via https://wiki.saucelabs.com/display/DOCS/Platform+Configurator
    desired.browserName = '';
    desired.appiumVersion = '1.5.1';
    desired.deviceName = 'iPhone Simulator';
    desired.deviceOrientation = 'portrait';
  }
}

if (PLATFORM === 'android') {
  configureAndroid();
} else { // ios
  configureIos();
}

var driver;
var browser;
var sauceConnectProcess;
var failures = 0;
var numTries = 0;

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

function waitForZuul() {
  console.log('pinging zuul, try #' + (numTries + 1) + '...');
  var script = 'getZuulMessages()';

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

function uploadAndroidAppToSauceAndGetUrl() {
  var filepath = desired.app;

  var id = uuid.v4();
  return readFile(filepath).then(function (buffer) {
    var uploadUrl = 'https://saucelabs.com/rest/v1/storage/' +
      username + '/' + id + '.apk';
    return request({
      method: 'POST',
      uri: uploadUrl,
      body: buffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      auth: {
        user: username,
        pass: accessKey
      }
    });
  }).then(function () {
    return 'sauce-storage:' + id + '.apk';
  });
}

function uploadIosAppToSauceAndGetUrl() {
  var filepath = desired.app;
  var id = uuid.v4();

  return zipdir(filepath).then(function (buffer) {
    var uploadUrl = 'https://saucelabs.com/rest/v1/storage/' +
      username + '/' + id + '.zip';

    return request({
      method: 'POST',
      uri: uploadUrl,
      body: buffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      auth: {
        user: username,
        pass: accessKey
      }
    });
  }).then(function () {
    return 'sauce-storage:' + id + '.zip';
  });
}

function sauceSetup() {
  var options = {
    username: username,
    accessKey: accessKey,
    tunnelIdentifier: process.env['TRAVIS_JOB_NUMBER'] || 'tunnel-' + Date.now()
  };
  return new Promise(function (resolve, reject) {
    sauceConnectLauncher(options, function (err, process) {
      if (err) {
        return reject(err);
      }
      resolve(process);
    });
  }).then(function (process) {
    sauceConnectProcess = process;
    driver = wd.promiseChainRemote("localhost", 4445, username, accessKey);
    if (PLATFORM === 'android') {
      return uploadAndroidAppToSauceAndGetUrl();
    } else {
      return uploadIosAppToSauceAndGetUrl();
    }
  }).then(function (url) {
    desired.app = url;
    browser = driver.init(desired);
  });
}

function setup() {
  if (process.env.TRAVIS) {
    return sauceSetup();
  } else {
    driver = wd.promiseChainRemote('127.0.0.1', 4723);
    browser = driver.init(desired);
  }
}

function cleanup() {
  if (sauceConnectProcess) {
    sauceConnectProcess.close();
  }
}

Promise.resolve().then(function () {
  return setup();
}).then(function () {
  console.log('running tests on platform: ' + PLATFORM);
  return runTest();
}).then(function () {
  cleanup();
  console.log('done!');
  process.exit(0);
}).catch(function (err) {
  cleanup();
  console.log(err.stack);
  process.exit(1);
});
