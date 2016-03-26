require('bluebird').longStackTraces();
require('pouchdb').preferredAdapters = ['websql'];
require('chai').use(require('chai-as-promised'));

describe('sqlite plugin test suite', function () {
  this.timeout(120000);

  require('./test.main.js');
  require('./test.compaction.js');
  require('./test.mapreduce.js');
  require('./test.attachments.js');
  require('./test.basics.js');
  require('./test.changes.js');
  require('./test.bulk_docs.js');
  require('./test.all_docs.js');
  require('./test.replication.js');
});