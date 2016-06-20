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

describe('basic test suite', function () {

  it('throws error for openDatabase args < 1', function () {
    return expectError(Promise.resolve().then(function () {
      openDatabase();
    }));
  });
  it('does not throw error for openDatabase args < 2', function () {
    if (typeof sqlitePlugin === 'undefined') {
      return; // skip for websql
    }
    return Promise.resolve().then(function () {
      openDatabase(':memory:');
    });
  });
  it('does not throw error for openDatabase args < 3', function () {
    if (typeof sqlitePlugin === 'undefined') {
      return; // skip for websql
    }
    return Promise.resolve().then(function () {
      openDatabase(':memory:', '1.0');
    });
  });

  it('does not throw error for openDatabase args < 4', function () {
    if (typeof sqlitePlugin === 'undefined') {
      return; // skip for websql
    }
    return Promise.resolve().then(function () {
      openDatabase(':memory:', '1.0', 'hey');
    });
  });

  it('does not throw error for {name:"foo"} arg', function () {
    if (typeof sqlitePlugin === 'undefined') {
      return; // skip for websql
    }
    return Promise.resolve().then(function () {
      openDatabase({name: ':memory:'});
    });
  });

  it('does a basic database operation', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function (txn, result) {
          resolve(result);
        }, function (txn, err) {
          reject(err);
        });
      });
    }).then(function (res) {
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 1);
      assert.equal(res.rows.item(0)['1 + 1'], 2);
    });
  });

  it('handles an error - select', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return expectError(new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT foo FROM yolo', [], function (txn, result) {
          resolve(result);
        }, function (txn, err) {
          reject(err);
        });
      });
    }));
  });

  it('handles an error - drop', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return expectError(new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('DROP TABLE blargy blah', [], function (txn, result) {
          resolve(result);
        }, function (txn, err) {
          reject(err);
        });
      });
    }));
  });

  it('handles an error - delete', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return expectError(new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('DELETE FROM yolo', [], function (txn, result) {
          resolve(result);
        }, function (txn, err) {
          reject(err);
        });
      });
    }));
  });

  it('handles an error - create', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return expectError(new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE blargy blah', [], function (txn, result) {
          resolve(result);
        }, function (txn, err) {
          reject(err);
        });
      });
    }));
  });

  it('handles an error - insert', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return expectError(new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('INSERT INTO blargy blah', [], function (txn, result) {
          resolve(result);
        }, function (txn, err) {
          reject(err);
        });
      });
    }));
  });

  it('does multiple queries', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function (txn, result) {
          resolve(result);
        }, function (txn, err) {
          reject(err);
        });
      });
    }).then(function (res) {
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 1);
      assert.equal(res.rows.item(0)['1 + 1'], 2);

      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT 2 + 1', [], function (txn, result) {
            resolve(result);
          }, function (txn, err) {
            reject(err);
          });
        });
      });
    }).then(function (res) {
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 1);
      assert.equal(res.rows.item(0)['2 + 1'], 3);
    });
  });

  it('does multiple queries, same event loop', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        var results = new Array(2);
        var done = 0;
        function checkDone() {
          if (++done === 2) {
            resolve(results);
          }
        }

        txn.executeSql('SELECT 1 + 1', [], function (txn, result) {
          results[0] = result;
          checkDone();
        }, function (txn, err) {
          reject(err);
        });

        txn.executeSql('SELECT 2 + 1', [], function (txn, result) {
          results[1] = result;
          checkDone();
        }, function (txn, err) {
          reject(err);
        });

      });
    }).then(function (results) {
      assert.equal(results[0].rowsAffected, 0);
      assert.equal(results[0].rows.length, 1);
      assert.equal(results[0].rows.item(0)['1 + 1'], 2);

      assert.equal(results[1].rowsAffected, 0);
      assert.equal(results[1].rows.length, 1);
      assert.equal(results[1].rows.item(0)['2 + 1'], 3);
    });
  });

  it('calls transaction complete callback', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    var called = 0;

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
        });
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
          txn.executeSql('SELECT 1 + 1', [], function () {
            called++;
            txn.executeSql('SELECT 1 + 1', [], function () {
              called++;
            });
          });
        });
      }, reject, resolve);
    }).then(function () {
      assert.equal(called, 4);
    });
  });

  it('calls transaction complete callback - empty txn', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    var called = 0;

    return new Promise(function (resolve, reject) {
      db.transaction(function () {
      }, reject, resolve);
    }).then(function () {
      assert.equal(called, 0);
    });
  });

  it('calls transaction complete callback - null txn', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    return expectError(new Promise(function (resolve, reject) {
      try {
        db.transaction(null, reject, resolve);
      } catch (err) {
        reject(err);
      }
    }));
  });

  it('calls transaction error callback', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    var called = 0;

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
        });
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
          txn.executeSql('SELECT 1 + 1', [], function () {
            called++;
            txn.executeSql('SELECT yolo from baz', [], function () {
              called++;
            });
          });
        });
      }, function (err) {
        if (!err) {
          return reject(new Error('expected an error here'));
        }
        resolve();
      }, reject);
    }).then(function () {
      assert.equal(called, 3);
    });
  });

  it('recovers from errors', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    var called = 0;

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
        });
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
          txn.executeSql('SELECT 1 + 1', [], function () {
            called++;
            txn.executeSql('SELECT yolo from baz', [], function () {
              called++;
            }, function (err) {
              if (!err) {
                return reject(new Error('expected an error here'));
              }
              return false; // ack that the error was handled
            });
          });
        });
      }, reject, resolve);
    }).then(function () {
      assert.equal(called, 3);
    });
  });

  it('recovers from errors, returning undefined', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    var called = 0;

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
        });
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
          txn.executeSql('SELECT 1 + 1', [], function () {
            called++;
            txn.executeSql('SELECT yolo from baz', [], function () {
              called++;
            }, function (err) {
              if (!err) {
                return reject(new Error('expected an error here'));
              }
            });
          });
        });
      }, reject, resolve);
    }).then(function () {
      assert.equal(called, 3);
    });
  });

  it('doesn\'t recover if you return true', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    var called = 0;

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
        });
        txn.executeSql('SELECT 1 + 1', [], function () {
          called++;
          txn.executeSql('SELECT 1 + 1', [], function () {
            called++;
            txn.executeSql('SELECT yolo from baz', [], function () {
              called++;
            }, function (err) {
              if (!err) {
                return reject(new Error('expected an error here'));
              }
              return true;
            });
          });
        });
      }, function (err) {
        if (!err) {
          return reject(new Error('expected an error here'));
        }
        resolve();
      }, reject);
    }).then(function () {
      assert.equal(called, 3);
    });
  });

  it('queries executed in right order', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);

    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('SELECT 1 + 1', [], function () {
          called.push('a');
        });
        txn.executeSql('SELECT 1 + 1', [], function () {
          called.push('k');
        });
        txn.executeSql('SELECT 1 + 1', [], function () {
          called.push('b');
          txn.executeSql('SELECT 1 + 1', [], function () {
            called.push('l');
          });
          txn.executeSql('SELECT 1 + 1', [], function () {
            called.push('c');
            txn.executeSql('SELECT 1 + 1', [], function () {
              called.push('m');
            });
            txn.executeSql('SELECT 1 + 1', [], function () {
              called.push('n');
            });
            txn.executeSql('SELECT yolo from baz', [], function () {
            }, function () {
              called.push('e');
              txn.executeSql('SELECT 1 + 1', [], function () {
                called.push('f');
                txn.executeSql('SELECT yolo from baz', [], function () {
                }, function () {
                  called.push('h');
                  txn.executeSql('SELECT 1 + 1', [], function () {
                    called.push('g');
                  });
                });
                txn.executeSql('SELECT 1 + 1', [], function () {
                  called.push('o');
                });
              });
            });
            txn.executeSql('SELECT 1 + 1', [], function () {
              called.push('i');
            });
          });
          txn.executeSql('SELECT 1 + 1', [], function () {
            called.push('j');
          });
        });
      }, reject, resolve);
    }).then(function () {
      assert.deepEqual(called,
        ["a","k","b","l","c","j","m","n","e","i","f","h","o","g"]);
    });
  });

  it('has a version', function () {
    var db = openDatabase(':memory:', '1.0', 'yolo', 100000);
    assert.equal(db.version, '1.0');
  });

});

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

describe('dedicated db test suite - in-memory', function () {

  var db;

  beforeEach(function () {
    db = openDatabase(':memory:', '1.0', 'yolo', 100000);
  });

  afterEach(function () {
    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('DROP TABLE IF EXISTS table1');
        txn.executeSql('DROP TABLE IF EXISTS table2');
        txn.executeSql('DROP TABLE IF EXISTS table3');
      }, reject, resolve);
    }).then(function () {
      db = null;
    });
  });

  it('returns correct rowsAffected/insertId 1', function () {
    var sql = 'SELECT 1 + 1';
    return transactionPromise(db, sql).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
    }).then(function () {
      var sql = 'SELECT 1 + 2';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
    });
  });

  it('returns correct rowsAffected/insertId 2', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function (res) {
      assert.equal(getInsertId(res), 0, 'insertId 1');
      assert.equal(res.rowsAffected, 0, '1 rowsAffected == ' + res.rowsAffected);
      assert.equal(res.rows.length, 0, 'rows.length');
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("foo", "bar")';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), 1, 'insertId 2');
      assert.equal(res.rowsAffected, 1, '2 rowsAffected == ' + res.rowsAffected);
      assert.equal(res.rows.length, 0, 'rows.length');
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, '3 rowsAffected == ' + res.rowsAffected);
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'foo',
        text2: 'bar'
      });
    });
  });

  it('returns correct rowsAffected/insertId 3', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function (res) {
      assert.equal(getInsertId(res), 0, 'insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("baz", "quux")';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), 1, 'insertId');
      assert.equal(res.rowsAffected, 1, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'baz',
        text2: 'quux'
      });
    });
  });

  it('returns correct rowsAffected/insertId 4', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function (res) {
      assert.equal(getInsertId(res), 0, 'insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("baz", "quux")';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), 1, 'insertId');
      assert.equal(res.rowsAffected, 1, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), 2);
      assert.equal(res.rowsAffected, 1, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
      var sql = 'UPDATE table1 SET text1 = "baz" WHERE text2 = "foobar";';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId 1');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
      var sql = 'UPDATE table1 SET text1 = "bongo" WHERE text2 = "haha";';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 1, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId 2');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 2, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'baz',
        text2: 'quux'
      });
      assert.deepEqual(res.rows.item(1), {
        text1: 'bongo',
        text2: 'haha'
      });
    });
  });

  it('returns correct rowsAffected/insertId 5', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function (res) {
      assert.equal(getInsertId(res), 0, 'insertId 1');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
    }).then(function () {
      var sql = 'CREATE TABLE table2 (text1 string, text2 string)';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), 0, 'insertId 2');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
      var sql = 'CREATE TABLE table3 (text1 string, text2 string)';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), 0, 'insertId 3');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 0, 'rows.length');
    });
  });

  it('returns correct rowsAffected/insertId - delete', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'DELETE FROM table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 0);
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'DELETE FROM table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 1);
      assert.equal(res.rows.length, 0);
    });
  });

  it('returns correct rowsAffected/insertId - delete 2', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'DELETE FROM table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 0);
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("baz", "bar")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'DELETE FROM table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 2);
      assert.equal(res.rows.length, 0);
    });
  });

  it('returns correct rowsAffected/insertId - drop 1', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'DROP TABLE table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 0);
    });
  });

  it('returns correct rowsAffected/insertId - drop 2', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'DROP TABLE table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 0);
    });
  });

  it('returns correct rowsAffected/insertId - drop 3', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("baz", "bar")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'DROP TABLE table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0);
      assert.equal(res.rowsAffected, 0);
      assert.equal(res.rows.length, 0);
    });
  });

  it('issue #33 - mixed string/null', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      return Promise.all([
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("foo", "bar")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, "baz")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("toto", null)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("buzz", "bozz")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, null)')
      ]);
    }).then(function () {
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(res.rows.length, 5);
      assert.deepEqual(res.rows.item(0), {
        text1: "foo",
        text2: "bar"
      });
      assert.deepEqual(res.rows.item(1), {
        text1: null,
        text2: "baz"
      });
      assert.deepEqual(res.rows.item(2), {
        text1: "toto",
        text2: null
      });
      assert.deepEqual(res.rows.item(3), {
        text1: "buzz",
        text2: "bozz"
      });
      assert.deepEqual(res.rows.item(4), {
        text1: null,
        text2: null
      });
    });
  });

  it('issue #33 - mixed string/null 2', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      return Promise.all([
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, "baz")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("foo", "bar")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("toto", null)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("buzz", "bozz")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, null)')
      ]);
    }).then(function () {
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(res.rows.length, 5);
      assert.deepEqual(res.rows.item(0), {
        text1: null,
        text2: "baz"
      });
      assert.deepEqual(res.rows.item(1), {
        text1: "foo",
        text2: "bar"
      });
      assert.deepEqual(res.rows.item(2), {
        text1: "toto",
        text2: null
      });
      assert.deepEqual(res.rows.item(3), {
        text1: "buzz",
        text2: "bozz"
      });
      assert.deepEqual(res.rows.item(4), {
        text1: null,
        text2: null
      });
    });
  });

  it('issue #33 - mixed integer/null', function () {
    var sql = 'CREATE TABLE table1 (text1 int, text2 int)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      return Promise.all([
        transactionPromise(db,
          'INSERT INTO table1 VALUES (1, 2)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, 3)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (4, null)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (5, 6)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, null)')
      ]);
    }).then(function () {
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(res.rows.length, 5);
      assert.deepEqual(res.rows.item(0), {
        text1: 1,
        text2: 2
      });
      assert.deepEqual(res.rows.item(1), {
        text1: null,
        text2: 3
      });
      assert.deepEqual(res.rows.item(2), {
        text1: 4,
        text2: null
      });
      assert.deepEqual(res.rows.item(3), {
        text1: 5,
        text2: 6
      });
      assert.deepEqual(res.rows.item(4), {
        text1: null,
        text2: null
      });
    });
  });

  it('issue #33 - mixed integer/null 2', function () {
    var sql = 'CREATE TABLE table1 (text1 int, text2 int)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      return Promise.all([
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, 3)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (1, 2)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (4, null)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (5, 6)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, null)')
      ]);
    }).then(function () {
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(res.rows.length, 5);
      assert.deepEqual(res.rows.item(0), {
        text1: null,
        text2: 3
      });
      assert.deepEqual(res.rows.item(1), {
        text1: 1,
        text2: 2
      });
      assert.deepEqual(res.rows.item(2), {
        text1: 4,
        text2: null
      });
      assert.deepEqual(res.rows.item(3), {
        text1: 5,
        text2: 6
      });
      assert.deepEqual(res.rows.item(4), {
        text1: null,
        text2: null
      });
    });
  });

  it('issue #33 - mixed float/null', function () {
    var sql = 'CREATE TABLE table1 (text1 float, text2 float)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      return Promise.all([
        transactionPromise(db,
          'INSERT INTO table1 VALUES (1, 2)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, 3)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (4, null)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (5, 6)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, null)')
      ]);
    }).then(function () {
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(res.rows.length, 5);
      assert.deepEqual(res.rows.item(0), {
        text1: 1,
        text2: 2
      });
      assert.deepEqual(res.rows.item(1), {
        text1: null,
        text2: 3
      });
      assert.deepEqual(res.rows.item(2), {
        text1: 4,
        text2: null
      });
      assert.deepEqual(res.rows.item(3), {
        text1: 5,
        text2: 6
      });
      assert.deepEqual(res.rows.item(4), {
        text1: null,
        text2: null
      });
    });
  });

  it('issue #33 - mixed blob/null', function () {
    var sql = 'CREATE TABLE table1 (text1 blob, text2 blob)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      return Promise.all([
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("a", "b")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, "c")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("d", null)'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES ("e", "f")'),
        transactionPromise(db,
          'INSERT INTO table1 VALUES (null, null)')
      ]);
    }).then(function () {
      var sql = 'SELECT * from table1';
      return transactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(res.rows.length, 5);
      assert.deepEqual(res.rows.item(0), {
        text1: 'a',
        text2: 'b'
      });
      assert.deepEqual(res.rows.item(1), {
        text1: null,
        text2: 'c'
      });
      assert.deepEqual(res.rows.item(2), {
        text1: 'd',
        text2: null
      });
      assert.deepEqual(res.rows.item(3), {
        text1: 'e',
        text2: 'f'
      });
      assert.deepEqual(res.rows.item(4), {
        text1: null,
        text2: null
      });
    });
  });

  it('valid read transaction', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'SELECT * from table1';
      return readTransactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId 2');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'toto',
        text2: 'haha'
      });
    });
  });

  it('throws error for writes during read-only transaction', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("quux", "haha")';
      return expectError(readTransactionPromise(db, sql));
    });
  });

  it('query ignored for invalid read-only transaction write', function () {
    var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
    return transactionPromise(db, sql).then(function () {
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("toto", "haha")';
      return transactionPromise(db, sql);
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("quux", "haha")';
      return expectError(readTransactionPromise(db, sql));
    }).then(function () {
      var sql = 'SELECT * from table1';
      return readTransactionPromise(db, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId 2');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'toto',
        text2: 'haha'
      });
    });
  });

});


describe('dedicated db test suite - actual DB', function () {

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
      }, reject, resolve);
    }).then(function () {
      db = null;
    });
  });


  it('stores data between two DBs', function () {
    var db1 = openDatabase('testdb', '1.0', 'yolo', 100000);
    var db2 = openDatabase('testdb', '1.0', 'yolo', 100000);

    return Promise.resolve().then(function () {
      var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
      return transactionPromise(db1, sql);
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("foo", "bar")';
      return transactionPromise(db1, sql);
    }).then(function () {
      var sql = 'SELECT * from table1;';
      return transactionPromise(db1, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'foo',
        text2: 'bar'
      });
      var sql = 'SELECT * from table1;';
      return transactionPromise(db2, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'foo',
        text2: 'bar'
      });
    });
  });

});

describe('dedicated db test suite - actual DB', function () {

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
      }, reject, resolve);
    }).then(function () {
      db = null;
    });
  });


  it('stores data between two DBs', function () {
    var db1 = openDatabase('testdb', '1.0', 'yolo', 100000);
    var db2 = openDatabase('testdb', '1.0', 'yolo', 100000);

    return Promise.resolve().then(function () {
      var sql = 'CREATE TABLE table1 (text1 string, text2 string)';
      return transactionPromise(db1, sql);
    }).then(function () {
      var sql = 'INSERT INTO table1 VALUES ("foo", "bar")';
      return transactionPromise(db1, sql);
    }).then(function () {
      var sql = 'SELECT * from table1;';
      return transactionPromise(db1, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'foo',
        text2: 'bar'
      });
      var sql = 'SELECT * from table1;';
      return transactionPromise(db2, sql);
    }).then(function (res) {
      assert.equal(getInsertId(res), void 0, 'no insertId');
      assert.equal(res.rowsAffected, 0, 'rowsAffected');
      assert.equal(res.rows.length, 1, 'rows.length');
      assert.deepEqual(res.rows.item(0), {
        text1: 'foo',
        text2: 'bar'
      });
    });
  });
});

describe('advanced test suite - actual DB', function () {

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

  it('handles errors and callback correctly 0', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE foo (bar text);', [], function () {
          called.push('a');
        });
        txn.executeSql('INSERT INTO foo VALUES ("baz")', [], function () {
          called.push('b');
        });
      }, function (err) {
        console.log(err);
        reject(err);
      }, resolve);
    }).then(function () {
      assert.deepEqual(called, ["a", "b"]);
    });
  });

  it('handles errors and callback correctly 1', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE foo (bar text);', [], function () {
          called.push('a');
        });
        txn.executeSql('INSERT INTO foo VALUES ("baz")', [], function () {
          called.push('b');
          txn.executeSql('INSERT INTO yolo VALUES ("hey")', [], function () {
            called.push('z');
          }, function () {
            called.push('c');
            txn.executeSql('INSERT INTO foo VALUES ("baz")', [], function () {
              called.push('f');
            });
          });
          txn.executeSql('INSERT INTO foo VALUES ("haha")', [], null, function () {
            called.push('e');
          });
        });
      }, function (err) {
        console.log(err);
        reject(err);
      }, resolve);
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "c", "f"]);
    });
  });

  it('handles errors and callback correctly 2', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table1 (bar text);', [], function () {
          called.push('a');
        });
        txn.executeSql('INSERT INTO table1 VALUES ("buzz")', [], function () {
          called.push('b');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'a': rowsToJson(res)});
          });
          txn.executeSql('INSERT INTO table1 VALUES ("hey")', [], null, function () {
            called.push('c');
            txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
              called.push({'d': rowsToJson(res)});
            });
            txn.executeSql('INSERT INTO table1 VALUES ("baz")', [], function () {
              called.push('f');
              txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
                called.push({'f': rowsToJson(res)});
              });
            });
            txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
              called.push({'e': rowsToJson(res)});
            });
          });
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'b': rowsToJson(res)});
          });
          txn.executeSql('INSERT INTO table1 VALUES ("haha")', [], null, function () {
            called.push('e');
            txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
              called.push({'d': rowsToJson(res)});
            });
          });
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'c': rowsToJson(res)});
          });
        });
      }, function (err) {
        console.log(err);
        reject(err);
      }, resolve);
    }).then(function () {
      assert.deepEqual(called, [
        "a",
        "b",
        {
          "a": [
            {"bar": "buzz"}
          ]
        },
        {
          "b": [
            {"bar": "buzz"},
            {"bar": "hey"}
          ]
        },
        {
          "c": [
            {"bar": "buzz"},
            {"bar": "hey"},
            {"bar": "haha"}
          ]
        }
      ]);
    });
  });

  it('handles errors and callback correctly 3', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table1 (bar text);', [], function () {
          called.push('a');
        });
        txn.executeSql('INSERT INTO table1 VALUES ("buzz")', [], function () {
          called.push('b');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'a': rowsToJson(res)});
          });
          txn.executeSql('INSERT INTO yolo VALUES ("hey")', [], null, function () {
            called.push('c');
            txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
              called.push({'d': rowsToJson(res)});
            });
            txn.executeSql('INSERT INTO table1 VALUES ("baz")', [], function () {
              called.push('f');
              txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
                called.push({'f': rowsToJson(res)});
              });
            });
            txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
              called.push({'e': rowsToJson(res)});
            });
          });
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'b': rowsToJson(res)});
          });
          txn.executeSql('INSERT INTO table1 VALUES ("haha")', [], null, function () {
            called.push('e');
            txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
              called.push({'d': rowsToJson(res)});
            });
          });
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'c': rowsToJson(res)});
          });
        });
      }, function (err) {
        console.log(err);
        reject(err);
      }, resolve);
    }).then(function () {
      assert.deepEqual(called, [
          "a",
          "b",
          {
            "a": [{"bar": "buzz"}]
          },
          "c",
          {
            "b": [{"bar": "buzz"}]
          },
          {
            "c": [{"bar": "buzz"}, {"bar": "haha"}
            ]
          },
          {
            "d": [{"bar": "buzz"}, {"bar": "haha"}]
          },
          "f",
          {
            "e": [{"bar": "buzz"}, {"bar": "haha"}, {"bar": "baz"}]
          },
          {
            "f": [{"bar": "buzz"}, {"bar": "haha"}, {"bar": "baz"}]
          }
        ]
      );
    });
  });

  it('handles errors and callback correctly 4', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table1 (bar text);', [], function () {
          called.push('a');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'1': rowsToJson(res)});
          });
        });
        txn.executeSql('INSERT INTO table1 VALUES ("a")', [], function () {
          called.push('b');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'2': rowsToJson(res)});
          });
        });
        txn.executeSql('INSERT INTO table1 VALUES ("c")', [], function () {
          called.push('c');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'3': rowsToJson(res)});
          });
        });
        txn.executeSql('DROP TABLE table1', [], function () {
          called.push('d');
        });
        txn.executeSql('CREATE TABLE table1 (bar text);', [], function () {
          called.push('e');
          txn.executeSql('SELECT * FROM table1', [], function (txn, res) {
            called.push({'4': rowsToJson(res)});
          });
        });

      }, function (err) {
        console.log(err);
        reject(err);
      }, resolve);
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "c", "d", "e", {"1": []}, {"2": []}, {"3": []}, {"4": []}]
      );
    });
  });

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
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('DELETE FROM table2', [], function () {
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
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "c", [{"foo": "a"}]]);
    });
  });

  it('rolls back after an error 2', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('DELETE FROM table2', [], function () {
            called.push('c');
            txn.executeSql('SELECT * FROM notexist', function () {
              called.push('z');
            });
          });
        }, resolve, reject);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "c", [{"foo": "a"}]]);
    });
  });

  it('rolls back after an error 3', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
            called.push('d');
          });
          txn.executeSql('INSERT INTO table2 VALUES ("z")', [], function () {
            called.push('c');
            txn.executeSql('INSERT INTO table2 VALUES ("v")', [], function () {
              called.push('f');
            });
            txn.executeSql('SELECT * FROM notexist', function () {
              called.push('z');
            });
            txn.executeSql('INSERT INTO table2 VALUES ("u")', [], function () {
              called.push('g');
            });
          });
          txn.executeSql('INSERT INTO table2 VALUES ("w")', [], function () {
            called.push('e');
          });
        }, resolve, reject);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "d", "c", "e", "f", [{"foo": "a"}]]);
    });
  });

  it('rolls back after an error 4', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.readTransaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function () {
            called.push('d');
          });
          // readTransaction throws an error here
          txn.executeSql('INSERT INTO table2 VALUES ("z")', [], function () {
            called.push('c');
          });
          txn.executeSql('SELECT * FROM table2', [], function () {
            called.push('e');
          });
        }, resolve, reject);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "d", [{"foo": "a"}]]);
    });
  });

  it('rolls back after an error 5', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.readTransaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function () {
            called.push('d');
          });
          txn.executeSql('SELECT * FROM table2', [], function () {
            called.push('e');
            txn.executeSql('SELECT * FROM table2', [], function () {
              called.push('f');
              // readTransaction throws an error here
              txn.executeSql('INSERT INTO table2 VALUES ("z")', [], function () {
                called.push('c');
              });
            });
          });
        }, resolve, reject);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "d", "e", "f", [{"foo": "a"}]]);
    });
  });

  it('does not roll back if caught 1', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.readTransaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function () {
            called.push('d');
          });
          // readTransaction throws an error here
          txn.executeSql('INSERT INTO table2 VALUES ("z")', [], function () {
            called.push('c');
          }, function () {
            called.push('g');
          });
          txn.executeSql('SELECT * FROM table2', [], function () {
            called.push('e');
          });
        }, reject, resolve);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "d", "g", "e", [{"foo": "a"}]]);
    });
  });

  it('does not roll back if caught 2', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('INSERT INTO table2 VALUES ("n")', [], function () {
            called.push('d');
          });
          txn.executeSql('INSERT INTO yolo VALUES ("z")', [], function () {
            called.push('c');
          }, function () {
            called.push('g');
            txn.executeSql('INSERT INTO table2 VALUES ("p")', [], function () {
              called.push('f');
            });
          });
          txn.executeSql('INSERT INTO table2 VALUES ("o")', [], function () {
            called.push('e');
          });
        }, reject, resolve);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, [
        "a", "b", "d", "g", "e", "f", [{"foo": "a"},
          {"foo": "n"}, {"foo": "o"}, {"foo": "p"}]]);
    });
  });

  it('does not roll back if caught 3', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('INSERT INTO table2 VALUES ("a")', [], function () {
            called.push('b');
          });
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('INSERT INTO table2 VALUES ("n")', [], function () {
            called.push('d');
          });
          txn.executeSql('INSERT INTO yolo VALUES ("z")', [], function () {
            called.push('c');
          }, function () {
            called.push('g');
            txn.executeSql('INSERT INTO yolo VALUES ("p")', [], function () {
              called.push('f');
            }, function () {
              called.push('h');
              txn.executeSql('INSERT INTO table2 VALUES ("x")', [], function () {
                called.push('i');
              });
              txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
                called.push('j');
              });
              txn.executeSql('INSERT INTO table2 VALUES ("z")', [], function () {
                called.push('k');
              });
            });
          });
          txn.executeSql('INSERT INTO table2 VALUES ("o")', [], function () {
            called.push('e');
          });
        }, reject, resolve);
      });
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, [
        "a", "b", "d", "g", "e", "h", "i", "j", "k",
        [{"foo": "a"}, {"foo": "n"}, {"foo": "o"}, {"foo": "x"},
          {"foo": "y"}, {"foo": "z"}]]);
    });
  });

  it('query order matters 1', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('INSERT INTO table2 VALUES ("x")', [], function () {
          called.push('x');
        }, function () {
          called.push('y');
        });
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
        });
        txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
          called.push('z');
        }, function () {
          called.push('w');
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["y", "a", "z", [{"foo": "y"}]]);
    });
  });

  it('query order matters 2', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('INSERT INTO table2 VALUES ("x")', [], function () {
          called.push('x');
        }, function () {
          called.push('y');
        });
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('DELETE FROM table2 WHERE foo="y"', [], function () {
            called.push('c');
          });
        });
        txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
          called.push('z');
        }, function () {
          called.push('w');
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["y", "a", "z", "c", []]);
    });
  });

  it('query order matters 3', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
        });
        txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
          called.push('b');
        });
        txn.executeSql('DELETE FROM table2 WHERE foo="y"', [], function () {
          called.push('c');
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "c", []]);
    });
  });

  it('query order matters 4', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('DELETE FROM table2 WHERE foo="y"', [], function () {
            called.push('c');
          });
        });
        txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
          called.push('b');
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "b", "c", []]);
    });
  });

  it('query order matters 5', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
        });
        txn.executeSql('DELETE FROM table2 WHERE foo="y"', [], function () {
          called.push('c');
        });
        txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
          called.push('b');
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "c", "b", [{"foo": "y"}]]);
    });
  });

  it('query order matters 6', function () {
    var called = [];

    return new Promise(function (resolve, reject) {
      db.transaction(function (txn) {
        txn.executeSql('CREATE TABLE table2 (foo text)', [], function () {
          called.push('a');
          txn.executeSql('DROP TABLE table2;', [], function () {
            called.push('b');
          });
          txn.executeSql('CREATE TABLE table2 (foo text);', [], function () {
            called.push('c');
          });
          txn.executeSql('INSERT INTO table2 VALUES ("x")', [], function () {
            called.push('d');
          });
        });
        txn.executeSql('INSERT INTO table2 VALUES ("y")', [], function () {
          called.push('e');
        });
      }, reject, resolve);
    }).then(function () {
      return new Promise(function (resolve, reject) {
        db.transaction(function (txn) {
          txn.executeSql('SELECT * FROM table2', [], function (tx, res) {
            called.push(rowsToJson(res));
          });
        }, reject, resolve);
      });
    }).then(function () {
      assert.deepEqual(called, ["a", "e", "b", "c", "d", [{"foo": "x"}]]);
    });
  });

});
