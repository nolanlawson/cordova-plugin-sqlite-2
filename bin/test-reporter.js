'use strict';

// a nice test emitter for Zuul-style messages
require('colors');
var EE = require('events').EventEmitter;
var reporter = new EE();

reporter.on('console', function(msg) {
  console.log.apply(console, msg.args);
});

reporter.on('test', function(test) {
  console.log('starting', test.name.white);
});

reporter.on('test_end', function(test) {
  if (!test.passed) {
    console.log('failed', test.name.red);
    return;
  }
  console.log('passed:', test.name.green);
});

reporter.on('assertion', function(assertion) {
  console.log('Error: %s'.red, assertion.message);
  assertion.frames.forEach(function(frame) {
    console.log('    %s %s:%d'.grey, frame.func, frame.filename, frame.line);
  });
  console.log();
});

module.exports = reporter;