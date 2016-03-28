Cordova SQLite Plugin 2 [![Build Status](https://travis-ci.org/nolanlawson/sqlite-plugin-2.svg?branch=master)](https://travis-ci.org/nolanlawson/sqlite-plugin-2)
=====

**WORK IN PROGRESS. PLEASE DO NOT USE YET.**

A rewrite of the [Cordova SQLite Plugin](https://github.com/litehelpers/Cordova-sqlite-storage) (aka "SQLite storage"). For most apps, it should be a drop-in replacement.

This plugin allows you to use a [WebSQL](http://www.w3.org/TR/webdatabase/)-compatible API to store data
in your Cordova/PhoneGap/Ionic app, while proxying to a native SQLite database on the native side. The primary
benefits are:

1. unlimited storage
2. pre-populated databases in native apps
3. support where WebSQL isn't available (namely iOS WKWebView)

If you can avoid using this plugin in favor of [IndexedDB](http://w3c.github.io/IndexedDB/), then you should.
Performance, browser support, and future prospects are all better in IndexedDB.

Please see [Goals](#goals) and [Non-goals](#non-goals) for further explanation of why this plugin exists.

Usage
----

    cordova plugin add cordova-sqlite-plugin-2

Then you'll get a global `window.sqlitePlugin` variable, with an `openDatabase` function
that is exactly the same as WebSQL. Example usage:

```js
var db = sqlitePlugin.openDatabase('mydb.db', '1.0', '', 1);
db.transaction(function (txn) {
  txn.executeSql('SELECT 42 AS `answer` FROM sqlite_master', [], function (tx, res) {
    console.log(res.rows.item(0)); // {"answer": 42}
  });
});
```

Only the first argument to `openDatabase()` (the database name) is used.
The other values are for backwards compatibility with WebSQL.

For a tutorial on how to use WebSQL, check out [the HTML5 Rocks article](http://www.html5rocks.com/en/tutorials/webdatabase/todo/) or [the HTML5 Doctor article](http://html5doctor.com/introducing-web-sql-databases/).

Description
---

Since there are approximately a dozen ways to store data in a Cordova app, this plugin
needs to justify its existence.

#### Goals

This plugin aims for:

- **Minimalism:** Just polyfill WebSQL via native SQLite.
- **Correctness:** Over 600 automated tests that run in CI (many borrowed from the [PouchDB](http://pouchdb.com/) test suite).
- **Simplicity**: Uses [node-websql](https://github.com/nolanlawson/node-websql) to minimize native code. Transactional logic is mostly implemented in JavaScript.

Why not just use the original SQLite Plugin? Mostly because I just felt like rewriting it.
Also because I was unsatisfied with the lack of tests and occasional breakages due to the lack of tests. Hopefully
it will improve, and these two plugins can live side-by-side.

#### Non-goals

This project is not designed to provide 100% of the functionality of the old SQLite Plugin – deleting databases, closing databases, specifying a particular location, etc. The goal is just to provide a bridge to WebSQL, especially for environments where it doesn't work anymore and IndexedDB is not feasible (e.g. WKWebView on iOS).

IndexedDB is the future of storage on the web. If possible, you should use that, e.g. via wrapper library like [Dexie](http://dexie.org/), [LocalForage](http://mozilla.github.io/localForage/), or [PouchDB](http://pouchdb.com/). This plugin should be thought of as a polyfill for less-capable platforms ([namely iOS](http://www.raymondcamden.com/2014/09/25/IndexedDB-on-iOS-8-Broken-Bad/)) while we wait for their browser implementations to catch up.

**You should not use this library in Android.** Just don't. IndexedDB and WebSQL are well supported and faster on that platform.

**On iOS,** this plugin is still slower than native WebSQL due to the overhead of serializing data sent between the WebView and the native layer. (N.B.: just because something is "native" doesn't mean it's magically faster.) But sometimes native WebSQL isn't an option: e.g. you are using WKWebView (where [WebSQL is not supported](https://bugs.webkit.org/show_bug.cgi?id=137760)), or you need to store more than [the maximum allowed by Apple in regular WebSQL](https://pouchdb.com/errors.html#not_enough_space).

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

Or using WKWebView:

    WKWEBVIEW=1 npm run test-ios

To run the sanity tests against PhantomJS (using normal WebSQL):

    npm run test-phantom
