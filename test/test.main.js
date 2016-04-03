'use strict';

var Promise = require('bluebird');
var assert = require('assert');

/*jshint -W079 */
var openDatabase = typeof sqlitePlugin !== 'undefined' ?
  sqlitePlugin.openDatabase.bind(sqlitePlugin) :
  window.openDatabase.bind(window);

function expectError(promise) {
  return promise.then(function () {
    throw new Error('expected an error');
  }, function (err) {
    assert(err, 'error was thrown');
  });
}

function transactionPromise(db, sql, sqlArgs) {
  return new Promise(function (resolve, reject) {
    var result;
    db.transaction(function (txn) {
      txn.executeSql(sql, sqlArgs, function (txn, res) {
        result = res;
      });
    }, reject, function () {
      resolve(result);
    });
  });
}

function readTransactionPromise(db, sql, sqlArgs) {
  return new Promise(function (resolve, reject) {
    var result;
    db.readTransaction(function (txn) {
      txn.executeSql(sql, sqlArgs, function (txn, res) {
        result = res;
      });
    }, reject, function () {
      resolve(result);
    });
  });
}

function getInsertId(res) {
  try {
    return res.insertId; // WebSQL will normally throw an error on access here
  } catch (err) {
    return void 0;
  }
}

describe('advanced test suite - actual DB', function () {

  this.timeout(60000);

  var db;

  beforeEach(function () {
    db = openDatabase('testdb', '1.0', 'yolo', 100000);
  });

  afterEach(function () {
    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('DROP TABLE IF EXISTS table1');
        txn.executeSql('DROP TABLE IF EXISTS table2');
        txn.executeSql('DROP TABLE IF EXISTS table3');
        txn.executeSql('DROP TABLE IF EXISTS foo');
        txn.executeSql('DROP TABLE IF EXISTS yolo');
      }, reject, resolve);
    }).then(function () {
      db = null;
    });
  });

  function rowsToJson(res) {
    var output = [];
    for (var i = 0; i < res.rows.length; i++) {
      output.push(res.rows.item(i));
    }
    return JSON.parse(JSON.stringify(output));
  }

  it('handles errors and callback correctly 5', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table1 (bar text);', [], function () {
          called.push('a');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'1': rowsToJson(res)});
          });
        });
        txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
          called.push({'z': rowsToJson(res)});
        });
        txn.executeSql('INSERT INTO table1 VALUES ("a")', [], function () {
          called.push('b');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'2': rowsToJson(res)});
          });
        });
        txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
          called.push({'x': rowsToJson(res)});
        });
        txn.executeSql('INSERT INTO table1 VALUES ("b")', [], function () {
          called.push('c');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'3': rowsToJson(res)});
          });
        });
        txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
          called.push({'y': rowsToJson(res)});
        });
        txn.executeSql('DROP TABLE table1', [], function () {
          called.push('d');
        });
        txn.executeSql('SELECT * FROM table1', [], function () {
          called.push('should not happen');
        }, function () {
          called.push('expected error');
        });
        txn.executeSql('CREATE TABLE table1 (bar text);', [], function () {
          called.push('e');
          txn.executeSql('INSERT INTO table1 VALUES ("c")', [], function () {
            called.push('w');
            txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
              called.push({'v': rowsToJson(res)});
            });
          });
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'4': rowsToJson(res)});
          });
        });
        txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
          called.push({'x': rowsToJson(res)});
        });

      }, function (err) {
        console.log(err);
        reject(err);
      }, resolve);
    }).then(function () {
      assert.deepEqual(called, [
          "a",
          {"z": []},
          "b",
          {"x": [{"bar": "a"}]},
          "c",
          {"y": [{"bar": "a"}, {"bar": "b"}]},
          "d",
          "expected error",
          "e",
          {"x": []},
          {"1": []},
          {"2": []},
          {"3": []},
          "w",
          {"4": [{"bar": "c"}]},
          {"v": [{"bar": "c"}]}
        ]
      );
    });
  });

  it('rolls back after an error 1', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table1 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table1 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('DELETE FROM table1', [], function () {
            called.push('c');
          });
          txn.executeSql('SELECT * FROM notexist', function () {
            called.push('z');
          });
        }, resolve, reject);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table1', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "c", [{"foo": "a"}]]);
    });
  });

});