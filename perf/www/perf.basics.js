'use strict';

var PouchDB = require('pouchdb');

module.exports = function (opts) {

  var utils = require('./utils');
  var commonUtils = require('./common-utils.js');

  var testCases = [
    {
      name: 'basic-inserts',
      assertions: 1,
      iterations: 1000,
      setup: function (db, callback) {
        callback(null, {'yo': 'dawg'});
      },
      test: function (db, itr, doc, done) {
        db.post(doc, done);
      }
    }, {
      name: 'basic-gets',
      assertions: 1,
      iterations: 1000,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({
            _id: commonUtils.createDocId(i),
            foo: 'bar', baz: 'quux'
          });
        }
        db.bulkDocs({docs: docs}, callback);
      },
      test: function (db, itr, docs, done) {
        db.get(commonUtils.createDocId(itr), done);
      }
    }
  ];

  utils.runTests(PouchDB, 'basics', testCases, opts);
};
