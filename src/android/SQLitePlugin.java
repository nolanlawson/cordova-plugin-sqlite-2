package com.nolanlawson.cordova.sqlite;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import android.os.AsyncTask;
import android.util.Log;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.regex.Pattern;

public class SQLitePlugin extends CordovaPlugin {

  private static final String TAG = SQLitePlugin.class.getSimpleName();

  private static final String ACTION_RUN = "run";
  private static final String ACTION_ALL = "all";

  private static final Object[][] EMPTY_RESULTS = new Object[][]{};

  private static final Pattern PATTERN_INSERT = Pattern.compile("^\\s*INSERT", Pattern.CASE_INSENSITIVE);

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
    Log.d(TAG, "execute(" + action + ")");
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
    SQLiteDatabase db = SQLiteDatabase.openOrCreateDatabase(dbName, null);
    if (actionType == ActionType.ALL) {
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
        Log.d(TAG, "sql: " + sql);
        Log.d(TAG, "rows: " + Arrays.toString(rows));
        return new PluginResult(rows, 0, 0, null);
      } finally {
        if (cursor != null) {
          cursor.close();
        }
      }

    } else {
      SQLiteStatement statement = db.compileStatement(sql);
      if (PATTERN_INSERT.matcher(sql).find()) {
        long insertId = statement.executeInsert();
        return new PluginResult(EMPTY_RESULTS, 0, insertId, null);
      } else {
        int rowsAffected = statement.executeUpdateDelete();
        return new PluginResult(EMPTY_RESULTS, rowsAffected, 0, null);
      }
    }
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
        this.backgroundTaskArgs.callbackContext.error(pluginResult.error.toString());
      } else {
        this.backgroundTaskArgs.callbackContext.success(pluginResultToJson(pluginResult));
      }
      return null;
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
      Log.d(TAG, "jsonObject: " + jsonObject.toString());

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
