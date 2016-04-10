import map from 'lodash.map';
import SQLiteResult from './SQLiteResult';
import zipObject from 'lodash.zipObject';

function massageError(err) {
  return typeof err === 'string' ? new Error(err) : err;
}

function SQLiteDatabase(name) {
  this._name = name;
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
    callback(null, massageResults(results));
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