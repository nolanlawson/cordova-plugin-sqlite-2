
'use strict';

if (!global.Promise) {
  global.Promise = require('bluebird');
}

var PouchDB = require('pouchdb');

var opts = {adapter: 'websql', size: 50, location: 'default'};

function runTestSuites() {
  var reporter = require('./perf.reporter');
  reporter.log('Testing PouchDB version ' + PouchDB.version +
    (opts.adapter ?
      (', using adapter: ' + opts.adapter) : '') +
    '\n\n');

  require('./perf.basics')(opts);
}

document.addEventListener('deviceready', runTestSuites, false);
