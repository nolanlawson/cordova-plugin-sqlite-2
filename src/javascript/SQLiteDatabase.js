import map from 'lodash.map';
import zipObject from 'lodash.zipobject';
import SQLiteResult from './SQLiteResult';

function massageError(err) {
  return typeof err === 'string' ? new Error(err) : err;
}

function SQLiteDatabase(name) {
  this._name = name;
}

function dearrayifyRow(res) {
  // use a compressed array format to send minimal data between
  // native and web layers
  var error = massageError(res[0]);
  var insertId = res[1];
  if (insertId === null) {
    insertId = void 0; // per the spec, should be undefined
  }
  var rowsAffected = res[2];
  var columns = res[3];
  var rows = res[4];
  var zippedRows = map(rows, function (row) {
    return zipObject(columns, row);
  });

  // v8 likes predictable objects
  return new SQLiteResult(error, insertId, rowsAffected, zippedRows);
}

// send less data over the wire, use an array
function arrayifyQuery(query) {
  return [query.sql, (query.args || [])];
}

SQLiteDatabase.prototype.exec = function exec(queries, readOnly, callback) {

  function onSuccess(rawResults) {
    if (typeof rawResults === 'string') {
      rawResults = JSON.parse(rawResults);
    }
    var results = map(rawResults, dearrayifyRow);
    callback(null, results);
  }

  function onError(err) {
    callback(massageError(err));
  }

  cordova.exec(onSuccess, onError, 'SQLitePlugin', 'exec', [
    this._name,
    queries.map(arrayifyQuery),
    readOnly
  ]);
};


export default SQLiteDatabase;