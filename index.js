/*global Primus*/
'use strict';

var substream = require('./substream');

/**
 * SubStream for the Primus server.
 *
 * @param {Primus} primus The Primus real-time server.
 * @api public
 */
exports.server = function server(primus) {
  var Stream = require('stream')
    , SubStream = substream(Stream)
    , emit = Stream.prototype.emit
    , Spark = primus.Spark;

  /**
   * Return a preconfigured listener.
   *
   * @param {String} event Name of the event.
   * @returns {Function} listener
   * @api private
   */
  function listen(event, spark) {
    if ('end' === event) return function end() {
      if (!spark.streams) return;

      for (var stream in spark.streams) {
        stream = spark.streams[stream];
        if (stream.end) stream.end();
      }
    };

    if ('readyStateChange' === event) return function change(reason) {
      if (!spark.streams) return;

      for (var stream in spark.streams) {
        stream = spark.streams[stream];
        stream.readyState = spark.readyState;
        if (stream.emit) emit.call(stream, event, reason);
      }
    };

    return function proxy() {
      if (!spark.streams) return;

      var args = Array.prototype.slice.call(arguments, 0);

      for (var stream in spark.streams) {
        if (stream.emit) emit.call(stream, [event].concat(args));
      }
    };
  }

  /**
   * Setup the Primus instance so we can start creating substreams.
   *
   * @param {Spark} spark Incoming connection
   * @api private
   */
  function setup(spark) {
    spark.streams = {};

    Object.keys(spark.reserved.events).filter(function filter(event) {
      return 'data' !== event;
    }).forEach(function each(event) {
      spark.on(event, listen(event, spark));
    });
  }

  /**
   * Create a new namespace.
   *
   * @param {String} name Namespace id
   * @returns {Namespace}
   * @api private
   */
  Spark.prototype.substream = function substream(name) {
    if (!this.streams) setup(this);
    if (!this.streams[name]) this.streams[name] = new SubStream(this, name, {
      primus: this.primus
    });

    return this.streams[name];
  };

  /**
   * Intercept the incoming messages to see if they belong to a given substream.
   *
   * @param {Object} packet The message packet.
   * @api private
   */
  primus.transform('incoming', function incoming(packet) {
    var next;

    if (!this.streams) return;

    for (var stream in this.streams) {
      stream = this.streams[stream];

      if (stream.mine && stream.mine(packet.data)) {
        next = false;
        break;
      }
    }

    return next;
  });
};

/**
 * SubStream for the Primus client API.
 *
 * @param {Primus} primus The Primus client.
 * @api public
 */
exports.client = function client(primus) {
  var SubStream = Primus._substream(Primus.Stream)
    , emit = Primus.Stream.prototype.emit;

  /**
   * Return a preconfigured listener.
   *
   * @param {String} event Name of the event.
   * @returns {Function} listener
   * @api private
   */
  function listen(event) {
    if ('end' === event) return function end() {
      if (!primus.streams) return;

      for (var stream in primus.streams) {
        stream = primus.streams[stream];
        if (stream.end) stream.end();
      }
    };

    if ('readyStateChange' === event) return function change(reason) {
      if (!primus.streams) return;

      for (var stream in primus.streams) {
        stream = primus.streams[stream];
        stream.readyState = primus.readyState;
        if (stream.emit) emit.call(stream, event, reason);
      }
    };

    return function proxy() {
      if (!primus.streams) return;

      var args = Array.prototype.slice.call(arguments, 0);

      for (var stream in primus.streams) {
        if (stream.emit) emit.call(stream, [event].concat(args));
      }
    };
  }

  /**
   * Setup the Primus instance so we can start creating substreams.
   *
   * @api private
   */
  function setup() {
    primus.streams = {};

    for (var event in primus.reserved.events) {
      if ('data' === event) continue;

      primus.on(event, listen(event));
    }
  }

  /**
   * Create a new namespace.
   *
   * @param {String} name Namespace id
   * @returns {Namespace}
   * @api private
   */
  primus.substream = function substream(name) {
    //
    // First time that we've been called, setup the additional data structure
    // for this connection and make sure we set all our listeners once to reduce
    // memory when using a large portion of listeners.
    //
    if (!primus.streams) setup();
    if (!primus.streams[name]) primus.streams[name] = new SubStream(primus, name, {
      primus: primus
    });

    return primus.streams[name];
  };

  /**
   * Intercept the incoming messages to see if they belong to a given substream.
   *
   * @param {Object} packet The message packet.
   * @api private
   */
  primus.transform('incoming', function incoming(packet) {
    var next;

    if (!this.streams) return;

    for (var stream in this.streams) {
      stream = this.streams[stream];

      if (stream.mine && stream.mine(packet.data)) {
        next = false;
        break;
      }
    }

    return next;
  });
};

//
// Expose the library.
//
exports.library = 'Primus._substream = '+ substream.toString();
