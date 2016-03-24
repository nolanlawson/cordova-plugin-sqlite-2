package com.nolanlawson.cordova.sqlite;

import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import android.os.AsyncTask;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.regex.Pattern;

public class SQLitePlugin extends CordovaPlugin {

  private static final String ACTION_RUN = "run";
  private static final String ACTION_ALL = "all";

  private static final Pattern PATTERN_INSERT = Pattern.compile("^\\s*INSERT", Pattern.CASE_INSENSITIVE);

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
    if (action.equals(ACTION_RUN)) {
      this.run(args, callbackContext);
      return true;
    } else if (action.equals(ACTION_ALL)) {
      /*String message = args.getString(0);
      this.echo(message, callbackContext);
      return true;*/
    }
    return false;
  }

  private void run(JSONArray args, CallbackContext context) {
    BackgroundTaskArgs backgroundTaskArgs = new BackgroundTaskArgs(args, context);
    new BackgroundTask(backgroundTaskArgs)
        .executeOnExecutor(AsyncTask.THREAD_POOL_EXECUTOR);
  }

  private PluginResult runInBackground(BackgroundTaskArgs backgroundTaskArgs) {
    try {
      return runInBackgroundAndPossiblyThrow(backgroundTaskArgs);
    } catch (JSONException e) {
      return new PluginResult(new Object[0], 0, 0, e);
    }
  }

  private PluginResult runInBackgroundAndPossiblyThrow(BackgroundTaskArgs backgroundTaskArgs) throws JSONException {
    JSONArray args = backgroundTaskArgs.jsonArray;
    String dbName = args.getString(0);
    String sql = args.getString(1);
    JSONArray jsonArray = args.getJSONArray(2);
    int len = jsonArray.length();
    Object[] bindArgs = new Object[len];
    for (int i = 0; i < len; i++) {
      bindArgs[i] = jsonArray.getString(i);
    }
    SQLiteDatabase db = SQLiteDatabase.openOrCreateDatabase(dbName, null);
    SQLiteStatement statement = db.compileStatement(sql);
    if (PATTERN_INSERT.matcher(sql).find()) {
      long insertId = statement.executeInsert();
      return new PluginResult(new Object[0], 0, insertId, null);
    } else {
      int rowsAffected = statement.executeUpdateDelete();
      return new PluginResult(new Object[0], rowsAffected, 0, null);
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
      jsonObject.put("rows", result.rows);

      return jsonObject;
    } catch (JSONException e) {
      throw new RuntimeException(e); // should never happen
    }
  }

  private static class PluginResult {
    public final Object[] rows;
    public final int rowsAffected;
    public final long insertId;
    public final Exception error;

    public PluginResult(Object[] rows, int rowsAffected, long insertId, Exception error) {
      this.rows = rows;
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

  private static class SqlArgs {
    public final String sql;
    public final Object[] bindArgs;

    public SqlArgs(String sql, Object[] bindArgs) {
      this.sql = sql;
      this.bindArgs = bindArgs;
    }
  }
}
