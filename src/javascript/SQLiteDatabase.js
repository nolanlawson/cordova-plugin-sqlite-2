import map from 'lodash.map';
import zipObject from 'lodash.zipobject';
import SQLiteResult from './SQLiteResult';

function massageError(err) {
  return typeof err === 'string' ? new Error(err) : err;
}

function SQLiteDatabase(name) {
  this._name = name;
}

function parseRow(res) {
  // use a compressed array format to send minimal data between
  // native and web layers
  var error = massageError(res.error);
  var insertId = res.insertId;
  if (insertId === null) {
    insertId = void 0; // per the spec, should be undefined
  }
  var rowsAffected = res.rowsAffected || 0;
  var columns = res.columns || [];
  var rows = res.rows || [];
  var zippedRows = map(rows, function (row) {
    return zipObject(columns, row);
  });

  // v8 likes predictable objects
  return new SQLiteResult(error, insertId, rowsAffected, zippedRows);
}

SQLiteDatabase.prototype.exec = function exec(queries, readOnly, callback) {

  function onSuccess(rawResults) {
    if (typeof rawResults === 'string') {
      rawResults = JSON.parse(rawResults);
    }
    var results = map(rawResults, parseRow);
    callback(null, results);
  }

  function onError(err) {
    callback(massageError(err));
  }

  cordova.exec(onSuccess, onError, 'SQLitePlugin', 'exec', [
    this._name,
    queries,
    readOnly
  ]);
};


export default SQLiteDatabase;