package com.nolanlawson.cordova.sqlite;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import android.os.AsyncTask;
import android.util.Log;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

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

  private static final boolean DEBUG_MODE = false;

  private static final String TAG = SQLitePlugin.class.getSimpleName();

  private static final String ACTION_RUN = "run";
  private static final String ACTION_ALL = "all";

  private static final Object[][] EMPTY_ROWS = new Object[][]{};
  private static final String[] EMPTY_COLUMNS = new String[]{};

  private static final Pattern PATTERN_INSERT = Pattern.compile("^\\s*INSERT\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern PATTERN_START_TXN = Pattern.compile("^\\s*BEGIN\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern PATTERN_END_TXN = Pattern.compile("^\\s*END\\b", Pattern.CASE_INSENSITIVE);

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
    if (action.equals(ACTION_RUN)) {
      this.run(args, callbackContext);
      return true;
    } else if (action.equals(ACTION_ALL)) {
      this.all(args, callbackContext);
      return true;
    }
    return false;
  }

  private void run(JSONArray args, CallbackContext context) {
    BackgroundTaskArgs backgroundTaskArgs = new BackgroundTaskArgs(ActionType.RUN, args, context);
    new BackgroundTask(backgroundTaskArgs)
        .executeOnExecutor(SINGLE_EXECUTOR);
  }

  private void all(JSONArray args, CallbackContext context) {
    BackgroundTaskArgs backgroundTaskArgs = new BackgroundTaskArgs(ActionType.ALL, args, context);
    new BackgroundTask(backgroundTaskArgs)
        .executeOnExecutor(SINGLE_EXECUTOR);
  }

  private PluginResult runInBackground(BackgroundTaskArgs backgroundTaskArgs) {
    try {
      return runInBackgroundAndPossiblyThrow(backgroundTaskArgs);
    } catch (Throwable e) {
      return new PluginResult(EMPTY_ROWS, EMPTY_COLUMNS, 0, 0, e);
    }
  }

  private PluginResult runInBackgroundAndPossiblyThrow(BackgroundTaskArgs backgroundTaskArgs) throws JSONException {
    ActionType actionType = backgroundTaskArgs.actionType;
    JSONArray args = backgroundTaskArgs.jsonArray;
    String dbName = args.getString(0);
    String sql = args.getString(1);
    String[] bindArgs;
    if (args.isNull(2)) {
      bindArgs = null;
    } else {
      JSONArray jsonArray = args.getJSONArray(2);
      int len = jsonArray.length();
      bindArgs = new String[len];
      for (int i = 0; i < len; i++) {
        bindArgs[i] = jsonArray.getString(i);
      }
    }
    SQLiteDatabase db = getDatabase(dbName);
    if (actionType == ActionType.ALL) {
      return doAllTypeInBackgroundAndPossiblyThrow(sql, bindArgs, db);
    } else { // "run"
      return doRunTypeInBackgroundAndPossiblyThrow(sql, bindArgs, db);
    }
  }

  // do a "run" operation
  private PluginResult doRunTypeInBackgroundAndPossiblyThrow(String sql, String[] bindArgs, SQLiteDatabase db) {
    debug("\"run\" query: %s", sql);
    if (PATTERN_START_TXN.matcher(sql).find()) {
      debug("type: begin txn");
      db.beginTransaction();
      return new PluginResult(EMPTY_ROWS, EMPTY_COLUMNS, 0, 0, null);
    } else if (PATTERN_END_TXN.matcher(sql).find()) {
      debug("type: end txn");
      db.setTransactionSuccessful();
      db.endTransaction();
      return new PluginResult(EMPTY_ROWS, EMPTY_COLUMNS, 0, 0, null);
    } else {
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
  }

  // do an "all" operation
  private PluginResult doAllTypeInBackgroundAndPossiblyThrow(String sql, String[] bindArgs, SQLiteDatabase db) {
    debug("\"all\" query: %s", sql);
    Cursor cursor = null;
    try {
      debug("about to do rawQuery()");
      cursor = db.rawQuery(sql, bindArgs);
      debug("did rawQuery()");
      String[] columnNames = new String[cursor.getColumnCount()];
      for (int i = 0; i < columnNames.length; i++) {
        columnNames[i] = cursor.getColumnName(i);
      }
      Object[][] rows = new Object[cursor.getCount()][];
      for (int i = 0; cursor.moveToNext(); i++) {
        int numColumns = cursor.getColumnCount();
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
      PluginResult pluginResult = runInBackground(this.backgroundTaskArgs);

      if (pluginResult.error != null) {
        pluginResult.error.printStackTrace();
        this.backgroundTaskArgs.callbackContext.error(pluginResult.error.toString());
      } else {
        this.backgroundTaskArgs.callbackContext.success(pluginResultToJson(pluginResult));
      }
      return null;
    }
  }

  private static void debug(String line, Object... format) {
    if (DEBUG_MODE) {
      Log.d(TAG, String.format(line, format));
    }
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
    jsonResult.put(result.insertId);
    jsonResult.put(result.rowsAffected);
    jsonResult.put(columnNamesJsonArray);
    jsonResult.put(rowsJsonArray);
    debug("returning json: %s", jsonResult);
    return jsonResult;
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

  private enum ActionType {
    RUN,
    ALL
  }

  private static class BackgroundTaskArgs {
    public final ActionType actionType;
    public final JSONArray jsonArray;
    public final CallbackContext callbackContext;

    public BackgroundTaskArgs(ActionType actionType, JSONArray jsonArray, CallbackContext callbackContext) {
      this.actionType = actionType;
      this.jsonArray = jsonArray;
      this.callbackContext = callbackContext;
    }
  }

}
