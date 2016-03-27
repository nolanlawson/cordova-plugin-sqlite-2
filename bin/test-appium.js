'use strict';

var ANDROID_PATH = './test/platforms/android/build/outputs/apk/android-debug.apk';

var wd = require('wd');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var path = require('path');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

var app = path.resolve(ANDROID_PATH);

var desired = {
  'appium-version': '1.0',
  platformName: 'Android',
  deviceName: 'foobar',
  app: app,
  'app-package': 'com.nolanlawson.cordova.sqlite.test',
  'app-activity': 'MainActivity'
};

var browser = wd.promiseChainRemote('0.0.0.0', 4723);

browser.init(desired)
  .setImplicitWaitTimeout(3000)
  .contexts()
  .then(function (contexts) {
    var webViewContext = _.find(contexts, function (context) {
      return context.indexOf('WEBVIEW') !== -1;
    });
    return driver.context(webViewContext);
  })
  .then(function () {
    console.log('success!');
  });
