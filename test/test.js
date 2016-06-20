var bluebird = require('bluebird');
bluebird.longStackTraces();
var PouchDB = require('pouchdb-browser');
PouchDB.preferredAdapters = ['websql'];
var utils = require('pouchdb-utils');
var binUtils = require('pouchdb-binary-utils');
var pouchErrors = require('pouchdb-errors');
PouchDB.utils = {
  Promise: bluebird,
  btoa: binUtils.btoa,
  atob: binUtils.atob,
  binaryStringToBlobOrBuffer: binUtils.binaryStringToBlobOrBuffer,
  extend: require('js-extend').extend,
  ajax: require('pouchdb-ajax'),
  uuid: utils.uuid,
  createError: pouchErrors.createError
};
PouchDB.Errors = pouchErrors;
require('chai').use(require('chai-as-promised'));

describe('sqlite plugin test suite', function () {
  this.timeout(300000);

  require('./test.main.js');
  require('./test.compaction.js');
  require('./test.mapreduce.js');
  require('./test.attachments.js');
  require('./test.basics.js');
  require('./test.changes.js');
  require('./test.bulk_docs.js');
  require('./test.all_docs.js');
  require('./test.replication.js');
});
