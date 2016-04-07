
'use strict';

if (!global.Promise) {
  global.Promise = require('bluebird');
}

var PouchDB = require('pouchdb');

var opts = {adapter: 'websql'};

function runTestSuites() {
  /*
  var reporter = require('./perf.reporter');
  reporter.log('Testing PouchDB version ' + PouchDB.version +
    (opts.adapter ?
      (', using adapter: ' + opts.adapter) : '') +
    '\n\n');

  require('./perf.basics')(opts);
  require('./perf.views')(opts);
  require('./perf.attachments')(opts);*/
  var db = new PouchDB('foo');
  db.info().then(console.log.bind(console)).catch(console.log.bind(console));
}

document.addEventListener('deviceready', runTestSuites, false);
