import map from 'lodash.map';
import SQLiteResult from './SQLiteResult';
import zipObject from 'lodash.zipObject';

function massageError(err) {
  return typeof err === 'string' ? new Error(err) : err;
}

function SQLiteDatabase(name) {
  this._name = name;
}

function dearrayify(resultArray) {
  // use a compressed array format to send minimal data between
  // native and web layers
  var rawError = resultArray[0];
  if (rawError) {
    return new SQLiteResult(massageError(resultArray[0]));
  }
  var insertId = resultArray[1];
  if (insertId === null) {
    insertId = void 0; // per the spec, should be undefined
  }
  var rowsAffected = resultArray[2];
  var rows = resultArray[3];

  // v8 likes predictable objects
  return new SQLiteResult(null, insertId, rowsAffected, rows);
}

function massageResults(rawResults) {
  if (typeof rawResults === 'string') {
    return JSON.parse(rawResults);
  } else {
    return rawResults;
  }
}

// send less data over the wire, use an array
function arrayifyQuery(query) {
  return [query.sql, (query.args || [])];
}

SQLiteDatabase.prototype.exec = function exec(queries, readOnly, callback) {

  function onSuccess(results) {
    callback(null, map(massageResults(results), dearrayify));
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