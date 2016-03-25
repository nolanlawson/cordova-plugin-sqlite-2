package com.nolanlawson.cordova.sqlite;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import android.os.AsyncTask;
import android.util.Log;

import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

public class SQLitePlugin extends CordovaPlugin {

  private static final boolean DEBUG_MODE = true;

  private static final String TAG = SQLitePlugin.class.getSimpleName();

  private static final String ACTION_RUN = "run";
  private static final String ACTION_ALL = "all";

  private static final Object[][] EMPTY_RESULTS = new Object[][]{};

  private static final Pattern PATTERN_INSERT = Pattern.compile("^\\s*INSERT\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern PATTERN_START_TXN = Pattern.compile("^\\s*BEGIN\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern PATTERN_END_TXN = Pattern.compile("^\\s*END\\b", Pattern.CASE_INSENSITIVE);

  private static final Map<String, SQLiteDatabase> DATABASES = new HashMap<String, SQLiteDatabase>();

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
        .executeOnExecutor(AsyncTask.THREAD_POOL_EXECUTOR);
  }

  private void all(JSONArray args, CallbackContext context) {
    BackgroundTaskArgs backgroundTaskArgs = new BackgroundTaskArgs(ActionType.ALL, args, context);
    new BackgroundTask(backgroundTaskArgs)
        .executeOnExecutor(AsyncTask.THREAD_POOL_EXECUTOR);
  }

  private PluginResult runInBackground(BackgroundTaskArgs backgroundTaskArgs) {
    try {
      return runInBackgroundAndPossiblyThrow(backgroundTaskArgs);
    } catch (Throwable e) {
      return new PluginResult(EMPTY_RESULTS, 0, 0, e);
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
      return new PluginResult(EMPTY_RESULTS, 0, 0, null);
    } else if (PATTERN_END_TXN.matcher(sql).find()) {
      debug("type: end txn");
      db.setTransactionSuccessful();
      db.endTransaction();
      return new PluginResult(EMPTY_RESULTS, 0, 0, null);
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
          return new PluginResult(EMPTY_RESULTS, 0, insertId, null);
        } else {
          debug("type: update/delete/etc.");
          int rowsAffected = statement.executeUpdateDelete();
          return new PluginResult(EMPTY_RESULTS, rowsAffected, 0, null);
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
      cursor = db.rawQuery(sql, bindArgs);
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
      debug("sql: %s", sql);
      return new PluginResult(rows, 0, 0, null);
    } finally {
      if (cursor != null) {
        cursor.close();
      }
    }
  }

  private SQLiteDatabase getDatabase(String name) {
    SQLiteDatabase database = DATABASES.get(name);
    if (database == null) {
      database = SQLiteDatabase.openOrCreateDatabase(name, null);
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

  private static JSONObject pluginResultToJson(PluginResult result) {
    try {
      JSONObject jsonObject = new JSONObject();

      jsonObject.put("insertId", result.insertId);
      jsonObject.put("rowsAffected", result.rowsAffected);

      JSONArray rowsJsonArray = new JSONArray();
      for (int i = 0; i < result.rows.length; i++) {
        Object[] columns = result.rows[i];
        JSONArray columnsJsonArray = new JSONArray();
        for (int j = 0; j < columns.length; j++) {
          columnsJsonArray.put(columns[j]);
        }
        rowsJsonArray.put(columnsJsonArray);
      }
      jsonObject.put("rows", rowsJsonArray);
      debug("jsonObject: %s", jsonObject);

      return jsonObject;
    } catch (JSONException e) {
      throw new RuntimeException(e); // should never happen
    }
  }

  private static class PluginResult {
    public final Object[][] rows;
    public final int rowsAffected;
    public final long insertId;
    public final Throwable error;

    public PluginResult(Object[][] rows, int rowsAffected, long insertId, Throwable error) {
      this.rows = rows;
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
