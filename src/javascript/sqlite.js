function massageError(err) {
  return typeof err === 'string' ? new Error(err) : err;
}

function Database(dbName) {
  this._dbName = dbName;
}

Database.prototype._exec = function exec(type, sql, sqlArgs, callback) {

  function onSuccess(successResult) {
    callback(null, successResult);
  }

  function onError(err) {
    callback(massageError(err));
  }

  cordova.exec(onSuccess,
    onError,
    "SQLitePlugin",
    type,
    [this._dbName, sql, sqlArgs]);
};

Database.prototype.all = function all(sql, sqlArgs, callback) {
  this._exec('all', sql, sqlArgs, callback);
};

Database.prototype.run = function run(sql, sqlArgs, callback) {
  this._exec('run', sql, sqlArgs, callback);
};

function SQLite() {
}
SQLite.prototype.Database = Database;

export default new SQLite();