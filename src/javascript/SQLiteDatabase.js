import map from 'lodash.map';
import SQLiteResult from './SQLiteResult';
import zipObject from 'lodash.zipObject';

function massageError(err) {
  return typeof err === 'string' ? new Error(err) : err;
}

function SQLiteDatabase(name) {
  this._name = name;
}

function dearrayifyRow(res) {
  // use a compressed array format to send minimal data between
  // native and web layers
  var rawError = res[0];
  if (rawError) {
    return new SQLiteResult(massageError(res[0]));
  }
  var insertId = res[1];
  if (insertId === null) {
    insertId = void 0; // per the spec, should be undefined
  }
  var rowsAffected = res[2];
  var columns = res[3];
  var rows = res[4];
  var zippedRows = [];
  for (var i = 0, len = rows.length; i < len; i++) {
    zippedRows.push(zipObject(columns, rows[i]));
  }

  // v8 likes predictable objects
  return new SQLiteResult(null, insertId, rowsAffected, zippedRows);
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
    map(queries, arrayifyQuery),
    readOnly
  ]);
};


export default SQLiteDatabase;