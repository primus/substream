describe('multi-stream', function test() {
  'use strict';

  var Primus = require('primus')
    , plugin = require('../')
    , chai = require('chai')
    , http = require('http')
    , expect = chai.expect
    , port = 1024
    , primus;

  chai.Assertion.includeStack = true;

  beforeEach(function (done) {
    var server = http.createServer();
    primus = new Primus(server, { transformer: 'websockets' });

    port++;
    server.listen(port, done);
  });

  afterEach(function (done) {
    primus.destroy(done);
  });

  it('is compatible as a server-side plugin', function () {
    primus.use('multi-stream', plugin);
    primus.save(__dirname+ '/primus.js');
  });

  it('is compatible as a client-side plugin', function () {
    primus.use('multi-stream', plugin);

    var Socket = primus.Socket;
  });

  it('exposes the substream function', function (done) {
    primus.use('substream', plugin);

    primus.on('connection', function (spark) {
      expect(spark.substream).to.be.a('function');
      spark.end();
    });

    var Socket = primus.Socket
      , socket = new Socket('http://localhost:'+ port);

    expect(socket.substream).to.be.a('function');
    socket.on('end', done);
  });

  describe('communication', function () {
    beforeEach(function () {
      primus.use('substream', plugin);
    });

    it('can communicate over a substream', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        foo.on('data', function (data) {
          expect(data).to.equal('foo');
          spark.end();

          done();
        });
      });

      var Socket = primus.Socket
        , socket = new Socket('http://localhost:'+ port);

      socket.on('open', function () {
        socket.substream('foo').write('foo');
      });
    });

    it('proxies the close events', function (done) {
      var ends = 0;

      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        foo.once('end', function () {
          ends++;
        });

        spark.once('end', function () {
          ends++;

          process.nextTick(function () {
            expect(ends).to.equal(4);

            done();
          });
        });
      });

      var Socket = primus.Socket
        , socket = new Socket('http://localhost:'+ port);

      socket.on('open', function () {
        var foo = socket.substream('foo');

        foo.once('end', function () {
          ends++;
        });

        setTimeout(function () {
          socket.end();
        }, 10);
      });

      socket.once('end', function () {
        ends++;
      });
    });

    it('also receives data on the client side', function (done) {
      primus.on('connection', function (spark) {
        spark.substream('foo').write('foo');
      });

      var Socket = primus.Socket
        , socket = new Socket('http://localhost:'+ port);

      socket.on('open', function () {
        socket.substream('foo').on('data', function (msg) {
          expect(msg).to.equal('foo');
          socket.end();
          done();
        });
      });
    });

    it('doesnt confuse multiple streams', function (done) {
      primus.on('connection', function (spark) {
        ['bar', 'baz', 'foo'].forEach(function (name) {
          var stream = spark.substream('/'+ name)
            , send = 0;

          stream.on('data', function (data) {
            expect(data).to.equal(name);
          });

          (function write() {
            if (send === 10) return;

            setTimeout(function () {
              stream.write(name);

              send++; write();
            }, 10);
          })();
        });
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , count = 0;

      socket.on('open', function () {
        ['bar', 'baz', 'foo'].forEach(function (name) {
          var stream = socket.substream('/'+ name);

          stream.on('data', function (data) {
            expect(data).to.equal(name);
            stream.write(data);

            count++;

            if (count === 30) {
              socket.end();
              done();
            }
          });
        });
      });
    });

    it('only emits the events once', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo')
          , counts = 0;

        foo.on('data', function (msg) {
          expect(msg).to.equal('Hello Server');
          globalcounts++;
          counts++;

          expect(counts).to.equal(1);

          if (globalcounts > 1) setTimeout(function () {
            done();
            done = function () {};
          }, 100);
        });
      });

      var Socket = primus.Socket
        , globalcounts = 0;

      [1, 2].forEach(function () {
        var socket = new Socket('http://localhost:'+ port +'/')
          , foo = socket.substream('foo');

        foo.write('Hello Server');
      });
    });

    it('proxies readyState', function (done) {
      primus.on('connection', function (spark) {
        done();
      });

      var socket = new primus.Socket('http://localhost:'+ port);
      var foo = socket.substream('foo');
      expect(foo.readyState).to.equal(socket.readyState);
    });
  });
});
