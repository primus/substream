describe('multi-stream', function test() {
  'use strict';

  var Primus = require('primus')
    , assume = require('assume')
    , plugin = require('../')
    , http = require('http')
    , port = 1024
    , primus;


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
      assume(spark.substream).to.be.a('function');
      spark.end();
    });

    var Socket = primus.Socket
      , socket = new Socket('http://localhost:'+ port);

    assume(socket.substream).to.be.a('function');
    socket.on('end', done);
  });

  describe('communication', function () {
    beforeEach(function () {
      primus.use('substream', plugin);
    });

    it('doesnt complain about leaking events', function (done) {
      this.timeout(30000);

      primus.on('connection', function (spark) {
        var y = 0;

        for (var i = 0; i < 100; i++) {
          spark.substream('foo-'+ i).on('data', function (data) {
            assume(data).to.equal('foo');

            if (++y !== 99) return;

            spark.end();
            done();
          });
        }
      });

      var Socket = primus.Socket
        , socket = new Socket('http://localhost:'+ port);

      socket.on('open', function () {
        for (var i = 0; i < 100; i++) {
          socket.substream('foo-'+ i).write('foo');
        }
      });
    });

    it('can communicate over a substream', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        foo.on('data', function (data) {
          assume(data).to.equal('foo');
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
            assume(ends).to.equal(4);

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
          assume(msg).to.equal('foo');
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
            assume(data).to.equal(name);
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
            assume(data).to.equal(name);
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
          assume(msg).to.equal('Hello Server');
          globalcounts++;
          counts++;

          assume(counts).to.equal(1);

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
        setTimeout(function () {
          assume(foo.readyState).to.equal(socket.readyState);
          done();

        }, 10);
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo');

      assume(foo.readyState).to.equal(socket.readyState);
    });

    it('returns the same substream instance when calling with same name', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo')
          , bar = spark.substream('foo');

        assume(foo).to.equal(bar);
        done();
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo')
        , bar = socket.substream('foo');

      assume(foo).to.equal(bar);
    });

    it('adds substreams as special streams property', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        assume(foo).to.equal(spark.streams.foo);
        done();
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo');

      assume(foo).to.equal(socket.streams.foo);
    });

    it('closes the substream when its ended on the client', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');
        foo.write('bar');

        foo.on('end', function end() {
          spark.end();
          done();
        });
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo');

      foo.on('data', function (msg) {
        if ('bar' === msg) foo.end();
      });
    });

    it('closes the substream when its ended on the server', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        foo.on('data', function (msg) {
          if ('bar' === msg) foo.end();
        });
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo');

      foo.write('bar');

      foo.on('end', function end() {
        socket.end();
        done();
      });
    });

    it('removes substreams from the streams object on end', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        foo.on('data', function (msg) {
          if ('bar' === msg) foo.end();
        });

        foo.on('end', function () {
          assume(spark.streams.foo).to.be.undefined();
        });
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo');

      foo.write('bar');

      foo.on('end', function end() {
        socket.end();
        assume(socket.streams.foo).to.be.undefined();
        done();
      });
    });

    it('returns false when ended', function (done) {
      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        foo.on('data', function (msg) {
          foo.end();
        });

        foo.on('end', function () {
          assume(foo.write('bar')).to.equal(false);
          spark.end();
          done();
        });
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo');

      foo.write('bar');
    });
  });

  describe('transform', function () {
    it('runs message transformers', function (done) {
      primus.use('substream', plugin);
      primus.transform('incoming', function (packet) {
        var data = packet.data;

        if (!data.event) return;

        assume(data.added).to.equal('bar');
        this.emit(data.event);
        return false;
      });

      primus.on('connection', function (spark) {
        var foo = spark.substream('foo');

        foo.on('custom', function () {
          spark.end();
          done();
        });

        foo.on('data', function () {
          throw new Error('I should be intercepted');
        });
      });

      var socket = new primus.Socket('http://localhost:'+ port)
        , foo = socket.substream('foo');

      socket.transform('outgoing', function (packet) {
        packet.data.added = 'bar';
      });

      foo.write({ event: 'custom' });
    });
  });
});
