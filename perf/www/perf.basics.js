'use strict';

var PouchDB = require('pouchdb');

module.exports = function (opts) {

  var utils = require('./utils');
  var commonUtils = require('./common-utils.js');

  var testCases = [
    {
      name: 'basic-inserts',
      assertions: 1,
      iterations: 2000,
      setup: function (db, callback) {
        callback(null, {'yo': 'dawg'});
      },
      test: function (db, itr, doc, done) {
        db.post(doc, done);
      }
    }, {
      name: 'bulk-inserts',
      assertions: 1,
      iterations: 500,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 100; i++) {
          docs.push({much : 'docs', very : 'bulk'});
        }
        callback(null, {docs : docs});
      },
      test: function (db, itr, docs, done) {
        db.bulkDocs(docs, done);
      }
    }, {
      name: 'basic-gets',
      assertions: 1,
      iterations: 4000,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 10000; i++) {
          docs.push({_id : commonUtils.createDocId(i),
            foo : 'bar', baz : 'quux'});
        }
        db.bulkDocs({docs : docs}, callback);
      },
      test: function (db, itr, docs, done) {
        db.get(commonUtils.createDocId(itr), done);
      }
    }, {
      name: 'all-docs-startkey-endkey',
      assertions: 1,
      iterations: 400,
      setup: function (db, callback) {
        var docs = [];
        for (var i = 0; i < 1000; i++) {
          docs.push({
            _id: commonUtils.createDocId(i),
            foo: 'bar',
            baz: 'quux'
          });
        }
        db.bulkDocs({docs: docs}, callback);
      },
      test: function (db, itr, docs, done) {
        var tasks = [];
        for (var i = 0; i < 10; i++) {
          tasks.push(i);
        }
        Promise.all(tasks.map(function (doc, i) {
          return db.allDocs({
            startkey: commonUtils.createDocId(i * 100),
            endkey: commonUtils.createDocId((i * 100) + 10),
            include_docs: true
          });
        })).then(function () {
          done();
        }, done);
      }
    }
  ];

  utils.runTests(PouchDB, 'basics', testCases, opts);
};
