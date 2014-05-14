'use strict';

var Primus = require('primus')
  , count = 0
  , server
  , primus;

//
// Some build in Node.js modules that we need:
//
var http = require('http')
  , fs = require('fs');

//
// Create a basic server that will send the compiled library or a basic HTML
// file which we can use for testing.
//
server = http.createServer(function server(req, res) {
  res.setHeader('Content-Type', 'text/html');
  fs.createReadStream(__dirname + '/index.html').pipe(res);
});

//
// Now that we've setup our basic server, we can setup our Primus server.
//
primus = new Primus(server, { transformer: 'engine.io' });

//
// Add the SubStream plugin.
//
primus.use('substream', require('../'));

//
// Listen for new connections and send data
//
primus.on('connection', function connection(spark) {
  console.log('new connection: ', spark.id);

  var foo = spark.substream('foo');
  foo.on('data', function (data) {
    console.log('foo received:', data, ++count, spark.id);
  });
});

//
// Everything is ready, listen to a port number to start the server.
//
server.listen(8888);
