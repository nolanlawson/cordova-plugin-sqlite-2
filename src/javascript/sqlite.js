function Database(dbName) {
  this._dbName = dbName;
}

Database.prototype.all = function all(sql, sqlArgs, callback) {
  var self = this;

  function onSuccess(winParam) {
    callback(null, winParam);
  }

  function onError(error) {
    callback(error);
  }

  cordova.exec(onSuccess,
    onError,
    "SQLitePlugin",
    "all",
    [self._dbName, sql, sqlArgs]);
};

Database.prototype.run = function run(sql, sqlArgs, callback) {
  var self = this;

  function onSuccess(winParam) {
    callback(null, winParam);
  }

  function onError(error) {
    callback(error);
  }

  cordova.exec(onSuccess,
    onError,
    "SQLitePlugin",
    "run",
    [self._dbName, sql, sqlArgs]);
};

function SQLite() {
}
SQLite.prototype.Database = Database;

export default new SQLite();