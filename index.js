/*global Primus*/
'use strict';

var library = require('fs').readFileSync(__dirname + '/substream.js', 'utf-8')
  , substream = require('load').compiler(library).substream;

/**
 * SubStream for the Primus server.
 *
 * @param {Primus} primus The Primus real-time server.
 * @api public
 */
exports.server = function server(primus) {
  var SubStream = substream(require('stream'))
    , Spark = primus.Spark;

  /**
   * Create a new namespace.
   *
   * @param {String} name Namespace id
   * @returns {Namespace}
   * @api private
   */
  Spark.prototype.substream = function substream(name) {
    if (!this.streams) this.streams = {};
    if (!this.streams[name]) this.streams[name] = new SubStream(this, name, {
      primus: this.primus,
      proxy: [ 'error' ]
    });

    return this.streams[name];
  };

  /**
   * Incoming message.
   *
   * @param {Object} packet The message packet
   * @api private
   */
  primus.transform('incoming', function incoming(packet) {
    var next;

    for (var stream in this.streams) {
      if (this.streams[stream].mine(packet.data)) next = false;
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
  var SubStream = substream(Primus.Stream);

  /**
   * Collection of SubStreams.
   *
   * @type {Object}
   * @api private
   */
  primus.streams = {};

  /**
   * Create a new namespace.
   *
   * @param {String} name Namespace id
   * @returns {Namespace}
   * @api private
   */
  primus.substream = function substream(name) {
    if (!primus.streams) primus.streams = {};
    if (!primus.streams[name]) primus.streams[name] = new SubStream(primus, name, {
      proxy: [
        'offline', 'online', 'timeout', 'reconnecting', 'open', 'reconnect',
        'error', 'close'
      ],
      primus: primus
    });

    return primus.streams[name];
  };

  /**
   * Incoming message.
   *
   * @param {Object} packet The message packet
   * @api private
   */
  primus.transform('incoming', function incoming(packet) {
    var next;

    for (var stream in this.streams) {
      if (this.streams[stream].mine(packet.data)) next = false;
    }

    return next;
  });
};

//
// Expose the library.
//
exports.library = library;
