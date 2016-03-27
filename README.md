Cordova SQLite Plugin 2 [![Build Status](https://travis-ci.org/nolanlawson/sqlite-plugin-2.svg?branch=master)](https://travis-ci.org/nolanlawson/sqlite-plugin-2)
=====

A rewrite of the [Cordova SQLite Plugin](https://github.com/litehelpers/Cordova-sqlite-storage) (aka "SQLite storage"). For most use cases, it should be a drop-in replacement.

Usage
----

    cordova plugin add cordova-sqlite-plugin-2

Then the API is exactly the same as WebSQL:

```js
var db = openDatabase('mydb', '1.0', 'mydb', 1);
db.transaction(function (txn) {
  txn.executeSql('select "hello world" from sqlite_master', [], function (tx, res) {
    console.log(res.rows.item(0)); // "hello world"
  });
});
```

Only the database name is used. The other values are for backwards compatibility with WebSQL.

For a tutorial on how to use WebSQL, check out [the HTML5 Rocks article](http://www.html5rocks.com/en/tutorials/webdatabase/todo/) or [the HTML5 Doctor article](http://html5doctor.com/introducing-web-sql-databases/).

Goals
---

- **Minimalism:** just polyfill the [WebSQL database API](http://www.w3.org/TR/webdatabase/) via native SQLite.
- **Correctness:** heavily tested, with over 600 tests that run in Travis CI.
- **Simplicity**: uses [node-websql](https://github.com/nolanlawson/node-websql) to minimize native code. Transactional logic is mostly implemented in JavaScript.

Non-goals
---

This project is not designed to provide 100% of the functionality of the old SQLite Plugin – deleting databases, closing databases, specifying a particular location, etc. The goal is just to provide a bridge to WebSQL, especially for environments where it doesn't work anymore and IndexedDB is not feasible (e.g. WKWebView on iOS).

IndexedDB is the future of storage on the web. If possible, you should use that, e.g. via wrapper library like [Dexie](http://dexie.org/), [LocalForage](https://github.com/mozilla/localForage), or [PouchDB](http://pouchdb.com/). This plugin should be thought of as a polyfill for less-capable platforms (namely iOS) while we wait for their browser implementations to catch up.

**You should not use this library in Android.** Just don't. IndexedDB and WebSQL are well supported and faster on that platform.

**On iOS,** this plugin is still slower than native WebSQL due to the overhead of serializing data sent between the WebView and the native layer. (N.B.: just because something is "native" doesn't mean it's magically faster.) But sometimes native WebSQL isn't an option: e.g. you are using WKWebView, or you need to store more than the maximum allowed by Apple.

Building
---

Check out the code, then run:

    npm install

Then:

    npm run build

This will build the JS files and write them to `dist/`.

Testing
----

To run the tests on any available Android device:

    npm run test-android

To run the tests on any available iOS device:

    npm run test-ios

To run the sanity tests against PhantomJS (using normal WebSQL):

    npm run test-phantom
