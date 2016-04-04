Cordova SQLite Plugin 2 [![Build Status](https://travis-ci.org/nolanlawson/sqlite-plugin-2.svg?branch=master)](https://travis-ci.org/nolanlawson/sqlite-plugin-2)
=====

**WORK IN PROGRESS. PLEASE DO NOT USE YET.**

A rewrite of the [Cordova SQLite Plugin](https://github.com/litehelpers/Cordova-sqlite-storage) (aka "SQLite storage"). In most cases, it should be a drop-in replacement.

This plugin allows you to use a [WebSQL](http://www.w3.org/TR/webdatabase/)-compatible API to store data
in your Cordova/PhoneGap/Ionic app, while proxying to a SQLite database on the native side. The main
benefits are:

1. unlimited storage
2. pre-populated databases
3. support where WebSQL isn't available (namely iOS WKWebView)

**Note:** if you can avoid using this plugin in favor of [IndexedDB](http://w3c.github.io/IndexedDB/), then you should.
Performance, browser support, and future prospects are all better in IndexedDB. Please see [goals](#goals) and [non-goals](#non-goals) for more explanation.

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

#### Goals

- **Minimalism:** Just polyfill WebSQL via native SQLite.
- **Correctness:** Over 600 automated tests that run in CI (many borrowed from the [PouchDB](http://pouchdb.com/) test suite).
- **Simplicity**: Uses [node-websql](https://github.com/nolanlawson/node-websql) to minimize native code. Transactional logic is mostly implemented in JavaScript. This reduces bugs and makes it easier to re-use code.

#### Non-goals

This project is not designed to provide 100% of the functionality of the old SQLite Plugin – deleting databases, closing databases, specifying a particular location, etc. The goal is just to provide a bridge to WebSQL, especially for environments where it doesn't work anymore and IndexedDB is not feasible (e.g. WKWebView on iOS).

IndexedDB is the future of storage on the web. If possible, you should use that, e.g. via wrapper library like [Dexie](http://dexie.org/), [LocalForage](http://mozilla.github.io/localForage/), or [PouchDB](http://pouchdb.com/). This plugin should be thought of as a polyfill for less-capable platforms ([namely iOS](http://www.raymondcamden.com/2014/09/25/IndexedDB-on-iOS-8-Broken-Bad/)) while we wait for their browser implementations to catch up.

#### Android vs iOS

**TLDR:** This plugin is more useful on iOS than on Android.

##### Android

If possible, you should avoid using this library on Android.
It works, but IndexedDB and WebSQL are better supported and faster on that platform.

To skip using it on Android, just do:

```js
document.addEventListener('deviceready', function () {
  if (/Android/i).test(navigator.userAgent)) {
    window.sqlitePlugin = null;
  }
}, false);
```

This will prevent tools like PouchDB from using the `sqlitePlugin` object, so they
can use IndexedDB/WebSQL instead.

##### iOS

On iOS, this plugin is still slower than native WebSQL due to the overhead of serializing data sent between the WebView and the native layer. But sometimes native WebSQL isn't an option: e.g. you are using WKWebView (where [WebSQL is not supported](https://bugs.webkit.org/show_bug.cgi?id=137760)), or you need to store more than [the maximum allowed by Apple in regular WebSQL](https://pouchdb.com/errors.html#not_enough_space).

#### Where is data stored?

On Android, it's stored in the app's local directory, under `files/`, accessed natively
via:

```java
File dir = getContext().getFilesDir();
```

On iOS, it's in the `NSLibraryDirectory` under `LocalDatabase/`, accessed natively via:

```objective-c
NSString *dir = [
  [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES)
    objectAtIndex: 0]
  stringByAppendingPathComponent:@"LocalDatabase"];
```

Any database you store in there is accessible by name, so it can be used for
preloading. E.g. a database called `foo.db` can be accessed via:

```js
var db = sqlitePlugin.openDatabase('foo.db', '1.0', '', 1);
```

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

Or to use normal WebSQL on either iOS or Android:

    WEBSQL=1 npm run test-ios
    WEBSQL=1 npm run test-android

Or to run the tests against PhantomJS, using normal WebSQL:

    npm run test-phantom
