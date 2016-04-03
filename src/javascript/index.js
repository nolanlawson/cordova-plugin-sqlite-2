import customOpenDatabase from 'websql/custom';
import SQLiteDatabase from './SQLiteDatabase';

var openDB = customOpenDatabase(SQLiteDatabase);

function SQLitePlugin() {
}

function openDatabase(name, version, description, size, callback) {
  if (name && typeof name === 'object') {
    // accept SQLite Plugin 1-style object here
    callback = version;
    size = name.size;
    description = name.description;
    version = name.version;
    name = name.name;
  }
  if (typeof name === 'undefined' ||
      typeof version === 'undefined' ||
      typeof description === 'undefined' ||
      typeof size === 'undefined') {
    throw new Error(
      'openDatabase() requires >=4 args: name, version, description, size');
  }
  return openDB(name, version, description, size, callback);
}

SQLitePlugin.prototype.openDatabase = openDatabase;

export default new SQLitePlugin();