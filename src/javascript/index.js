import customOpenDatabase from 'websql/custom';
import sqlite from './sqlite';

var openDatabase = customOpenDatabase(sqlite);

function SQLitePlugin() {
}

SQLitePlugin.prototype.openDatabase = openDatabase;

export default new SQLitePlugin();