var request = require('request');
var async = require('async');
var _ = require('lodash');

var couchdb = "http://localhost:5984";
var resultsdb = couchdb + "/all_the_numbers_results";
var numDocs = 1e4;
var batchSize = 1000;
var iterations = 10;
//var sleepTime = 1000; // hack for osx connection errors
var sleepTime = 0;

var resultsDdoc = {
  _id: "_design/all_the_numbers",
  language: "javascript",
  views: {
    by_test: {
      map: function(doc) {
        emit([doc.testBed, doc._id], doc.viewDuration);
      },
      reduce: "_stats"
    }
  }
};

var ddocs = {
  "base_spidermonkey": {
    _id: "_design/base_spidermonkey",
    "language": "javascript",
    "views": {
      "by_foo": {
        "map": function(doc) {
          if (doc.foo) {
            emit(doc.foo, null);
          }
        }
      }
    }
  }
};

var genDoc = function(val) {
  return {
    foo: val,
    bar: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
  };
};

// Convert view functions to strings
var stringifyViews = function(key, value) {
  if (key == "map" && typeof(value) == "function") {
    return value.toString();
  } else {
    return value;
  }
};

var checkResultsDb = function(cb) {
  request.get(resultsdb, function(err, resp) {
    if (err) throw(err);

    if (resp.statusCode == 404) {
      console.log("CREATING RESULTS DATBASE");
      request.put(resultsdb, function(err, resp, body) {
        if (err) throw(err);

        request.post({
          url: resultsdb,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(resultsDdoc, stringifyViews)
        }, function(err, resp) {
          if (err) throw(err);

          cb();
        });
      });
    } else {
      cb();
    }
  });
};

var runTests = function() {
  console.log("RUNNING TESTS -- (batchsize/numDocs):");
  console.log([batchSize, numDocs]);
  _.each(ddocs, function(ddoc, id) {
    console.log("BUILDING: "+id);
    var count = 0;
    var docBatches = [];
    var testdb = couchdb + "/all_the_numbers_test_" + id;

    while (count < numDocs) {
      docBatches.push(_.map(_.range(count, _.min([count + batchSize, numDocs])), genDoc));
      count += batchSize;
    }

    var funcs = [
      function(callback) {
        console.log("DELETING "+testdb);
        request.del(testdb, function(err, resp, body) {
          if (err) throw(err);

          callback();
        });
      },
      function(callback) {
        console.log("CREATING "+testdb);
        request.put(testdb, function(err, resp, body) {
          if (err) throw(err);

          callback();
        });
      },
    ];
    funcs = funcs.concat(_.map(docBatches, function(batch) {
      return function(callback) {
        request.post({
          url: testdb + "/_bulk_docs",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({docs: batch})
        }, function(err, resp) {
          if (err) throw(err);

          // HACK: sleep for a bit to get around OSX connection limits
          // Enable this if you hit: Error: connect EADDRINUSE
          if (sleepTime && sleepTime > 0) {
            setTimeout(function() { callback() }, sleepTime);
          } else {
            callback();
          }
        });
      };
    }));
    funcs.push(function(callback) {
      request.get({url:testdb, json:true}, function(err, resp, body) {
        var docCount = body.doc_count;
        if (docCount !== numDocs) {
          throw("INVALID DOC COUNT: GOT: "+docCount+" EXPECTED: "+numDocs);
        } else {
          console.log("FOUND DOCS: "+docCount+"/"+numDocs);
        }
        callback();
      });
    });
    funcs.push(function(callback) {
      request.post({
        url: testdb,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ddoc, stringifyViews)
      }, function(err, resp, body) {
        if (err) throw(err);

        callback();
      });
    });
    funcs.push(function(callback) {
      console.log("GENERATING VIEW");
      var start = (new Date()).getTime();
      request.get({
        url: testdb + "/_design/"+id+"/_view/by_foo?limit=1",
        json: true
      }, function(err, resp, body) {
        var end = (new Date()).getTime();
        var duration = (end - start) / 1000;
        console.log("VIEW BUILD DURATION: " + duration + " seconds");
        var results = {
          testBed: id,
          viewDuration: duration,
          numDocs: numDocs
        };
        request.post({
          url: resultsdb,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(results)
        }, function(err, resp, body) {
          if (err) throw(err);

          request.get({
            url: resultsdb + '/_design/all_the_numbers/_view/by_test?group_level=1&startkey=["'+id+'"]&endkey=["'+id+'",{}]',
            json:true
          }, function(err, resp, body) {
            if (err) throw(err);

            var data = body.rows[0];
            console.log("MIN DURATION: "+data.value.min);
            console.log("AVG DURATION: "+data.value.sum/data.value.count);
            console.log("MAX DURATION: "+data.value.max);
            console.log("CURRENT TEST DURATION: "+results.viewDuration);

            callback();
          });
        });
      });
    });
    async.series(funcs, function(err, results) {
      console.log("Finished processing view: " + id);
    });
  });
};

checkResultsDb(runTests);
