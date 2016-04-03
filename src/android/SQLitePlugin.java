package com.nolanlawson.cordova.sqlite;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import android.os.AsyncTask;
import android.util.Log;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
  * Author: Nolan Lawson
  * License: Apache 2
  */
public class SQLitePlugin extends CordovaPlugin {

  private static final boolean DEBUG_MODE = true;

  private static final String TAG = SQLitePlugin.class.getSimpleName();

  private static final Object[][] EMPTY_ROWS = new Object[][]{};
  private static final String[] EMPTY_COLUMNS = new String[]{};

  private static final Pattern PATTERN_SELECT = Pattern.compile("^\\s*SELECT\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern PATTERN_INSERT = Pattern.compile("^\\s*INSERT\\b", Pattern.CASE_INSENSITIVE);

  private static final Map<String, SQLiteDatabase> DATABASES = new HashMap<String, SQLiteDatabase>();

  private static final ThreadFactory threadFactory = new ThreadFactory() {
    public Thread newThread(Runnable r) {
      return new Thread(r, "SQLitePlugin BG Thread");
    }
  };
  private static final Executor SINGLE_EXECUTOR = new ThreadPoolExecutor(
      1, 1, 1,
      TimeUnit.SECONDS, new LinkedBlockingQueue<Runnable>(), threadFactory);

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
    debug("execute(%s)", action);
    this.run(args, callbackContext);
    return true;
  }

  private void run(JSONArray args, CallbackContext context) {
    BackgroundTaskArgs backgroundTaskArgs = new BackgroundTaskArgs(args, context);
    new BackgroundTask(backgroundTaskArgs)
        .executeOnExecutor(SINGLE_EXECUTOR);
  }

  private PluginResult[] runInBackground(BackgroundTaskArgs backgroundTaskArgs) {
    try {
      ExecArguments execArguments = jsonToExecArguments(backgroundTaskArgs.jsonArray);
      return execInBackgroundAndReturnResults(execArguments);
    } catch (Throwable e) {
      e.printStackTrace(); // should never happen
      throw new RuntimeException(e);
    }
  }

  private PluginResult[] execInBackgroundAndReturnResults(ExecArguments execArguments) throws JSONException {

    String dbName = execArguments.dbName;
    SQLQuery[] queries = execArguments.queries;
    boolean readOnly = execArguments.readOnly;
    PluginResult[] results = new PluginResult[queries.length];

    for (int i = 0; i < results.length; i++) {
      SQLQuery sqlQuery = queries[i];
      String sql = sqlQuery.sql;
      String[] bindArgs = sqlQuery.args;
      SQLiteDatabase db = getDatabase(dbName);
      try {
        if (PATTERN_SELECT.matcher(sql).find()) {
          results[i] = doSelectInBackgroundAndPossiblyThrow(sql, bindArgs, db);
        } else { // update/insert/delete
          if (readOnly) {
            results[i] = new PluginResult(EMPTY_ROWS, EMPTY_COLUMNS, 0, 0, new ReadOnlyException());
          } else {
            results[i] = doUpdateInBackgroundAndPossiblyThrow(sql, bindArgs, db);
          }
        }
      } catch (Throwable e) {
        results[i] = new PluginResult(EMPTY_ROWS, EMPTY_COLUMNS, 0, 0, e);
      }
    }
    return results;
  }

  // do a update/delete/insert operation
  private PluginResult doUpdateInBackgroundAndPossiblyThrow(String sql, String[] bindArgs,
                                                            SQLiteDatabase db) {
    debug("\"run\" query: %s", sql);
    SQLiteStatement statement = null;
    try {
      statement = db.compileStatement(sql);
      debug("compiled statement");
      if (bindArgs != null) {
        statement.bindAllArgsAsStrings(bindArgs);
      }
      debug("bound args");
      if (PATTERN_INSERT.matcher(sql).find()) {
        debug("type: insert");
        long insertId = statement.executeInsert();
        int rowsAffected = insertId >= 0 ? 1 : 0;
        return new PluginResult(EMPTY_ROWS, EMPTY_COLUMNS, rowsAffected, insertId, null);
      } else {
        debug("type: update/delete/etc.");
        int rowsAffected = statement.executeUpdateDelete();
        return new PluginResult(EMPTY_ROWS, EMPTY_COLUMNS, rowsAffected, 0, null);
      }
    } finally {
      if (statement != null) {
        statement.close();
      }
    }
  }

  // do a select operation
  private PluginResult doSelectInBackgroundAndPossiblyThrow(String sql, String[] bindArgs,
                                                            SQLiteDatabase db) {
    debug("\"all\" query: %s", sql);
    Cursor cursor = null;
    try {
      debug("about to do rawQuery()");
      cursor = db.rawQuery(sql, bindArgs);
      debug("did rawQuery()");
      int numColumns = cursor.getColumnCount();
      Object[][] rows = new Object[cursor.getCount()][];
      for (int i = 0; cursor.moveToNext(); i++) {
        Object[] columns = new Object[numColumns];
        for (int j = 0; j < numColumns; j++) {
          Object value = null;
          switch (cursor.getType(j)) {
            case Cursor.FIELD_TYPE_FLOAT:
              value = cursor.getFloat(j);
              break;
            case Cursor.FIELD_TYPE_INTEGER:
              value = cursor.getInt(j);
              break;
            case Cursor.FIELD_TYPE_BLOB:
              // convert byte[] to binary string; it's good enough, because
              // WebSQL doesn't support blobs anyway
              value = new String(cursor.getBlob(j));
              break;
            case Cursor.FIELD_TYPE_STRING:
              value = cursor.getString(j);
              break;
          }
          columns[j] = value;
        }
        rows[i] = columns;
      }
      String[] columnNames = new String[cursor.getColumnCount()];
      for (int j = 0; j < columnNames.length; j++) {
        columnNames[j] = cursor.getColumnName(j);
      }
      debug("returning %d rows", rows.length);
      return new PluginResult(rows, columnNames, 0, 0, null);
    } finally {
      if (cursor != null) {
        cursor.close();
      }
    }
  }

  private SQLiteDatabase getDatabase(String name) {
    debug("getDatabase(%s), my thread is %s", name, Thread.currentThread().getName());
    SQLiteDatabase database = DATABASES.get(name);
    if (database == null) {
      if (":memory:".equals(name)) {
        database = SQLiteDatabase.openOrCreateDatabase(name, null);
      } else {
        File file = new File(cordova.getActivity().getFilesDir(), name);
        database = SQLiteDatabase.openOrCreateDatabase(file, null);
      }
      DATABASES.put(name, database);
    }
    return database;
  }

  private class BackgroundTask extends AsyncTask<Void, Void, Void> {

    private BackgroundTaskArgs backgroundTaskArgs;

    public BackgroundTask(BackgroundTaskArgs backgroundTaskArgs) {
      this.backgroundTaskArgs = backgroundTaskArgs;
    }

    @Override
    protected Void doInBackground(Void... params) {
      debug("my thread is: %s", Thread.currentThread().getName());
      PluginResult[] pluginResults = runInBackground(this.backgroundTaskArgs);

      this.backgroundTaskArgs.callbackContext.success(pluginResultsToJson(pluginResults));
      return null;
    }
  }

  private static void debug(String line, Object... format) {
    if (DEBUG_MODE) {
      Log.d(TAG, String.format(line, format));
    }
  }

  private static JSONArray pluginResultsToJson(PluginResult[] results) {
    JSONArray jsonResults = new JSONArray();
    for (int i = 0; i < results.length; i++) {
      jsonResults.put(pluginResultToJson(results[i]));
    }
    return jsonResults;
  }

  private static JSONArray pluginResultToJson(PluginResult result) {
    JSONArray columnNamesJsonArray = new JSONArray();
    for (int i = 0; i < result.columns.length; i++) {
      columnNamesJsonArray.put(result.columns[i]);
    }

    JSONArray rowsJsonArray = new JSONArray();
    for (int i = 0; i < result.rows.length; i++) {
      Object[] columns = result.rows[i];
      JSONArray columnsJsonArray = new JSONArray();
      for (int j = 0; j < columns.length; j++) {
        columnsJsonArray.put(columns[j]);
      }
      rowsJsonArray.put(columnsJsonArray);
    }
    JSONArray jsonResult = new JSONArray();
    if (result.error != null) {
      jsonResult.put(result.error.getMessage());
    } else {
      jsonResult.put(null);
    }
    jsonResult.put(result.insertId);
    jsonResult.put(result.rowsAffected);
    jsonResult.put(columnNamesJsonArray);
    jsonResult.put(rowsJsonArray);
    debug("returning json: %s", jsonResult);
    return jsonResult;
  }

  private static ExecArguments jsonToExecArguments(JSONArray args) throws JSONException{
    String dbName = args.getString(0);
    JSONArray queries = args.getJSONArray(1);
    boolean readOnly = args.getBoolean(2);

    int len = queries.length();
    SQLQuery[] sqlQueries = new SQLQuery[len];

    for (int i = 0; i < len; i++) {
      JSONArray queryArray = queries.getJSONArray(i);
      String sql = queryArray.getString(0);
      JSONArray sqlArgsArray = queryArray.getJSONArray(1);
      int sqlArgsArrayLen = sqlArgsArray.length();
      String[] sqlArgs = new String[sqlArgsArrayLen];

      for (int j = 0; j < sqlArgsArrayLen; j++) {
        sqlArgs[j] = sqlArgsArray.getString(j);
      }

      sqlQueries[i] = new SQLQuery(sql, sqlArgs);
    }

    return new ExecArguments(dbName, sqlQueries, readOnly);
  }

  private static class PluginResult {
    public final Object[][] rows;
    public final String[] columns;
    public final int rowsAffected;
    public final long insertId;
    public final Throwable error;

    public PluginResult(Object[][] rows, String[] columns,
                        int rowsAffected, long insertId, Throwable error) {
      this.rows = rows;
      this.columns = columns;
      this.rowsAffected = rowsAffected;
      this.insertId = insertId;
      this.error = error;
    }
  }

  private static class BackgroundTaskArgs {
    public final JSONArray jsonArray;
    public final CallbackContext callbackContext;

    public BackgroundTaskArgs(JSONArray jsonArray, CallbackContext callbackContext) {
      this.jsonArray = jsonArray;
      this.callbackContext = callbackContext;
    }
  }

  private static class ExecArguments {
    public final String dbName;
    public final SQLQuery[] queries;
    public final boolean readOnly;

    public ExecArguments(String dbName, SQLQuery[] queries, boolean readOnly) {
      this.dbName = dbName;
      this.queries = queries;
      this.readOnly = readOnly;
    }
  }

  private static class SQLQuery {
    public final String sql;
    public final String[] args;

    public SQLQuery(String sql, String[] args) {
      this.sql = sql;
      this.args = args;
    }
  }

  private static class ReadOnlyException extends Exception {
    public ReadOnlyException() {
      super("could not prepare statement (23 not authorized)");
    }
  }

}
