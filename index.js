/*global Primus*/
'use strict';

var library = require('fs').readFileSync(__dirname + '/substream.js', 'utf-8')
  , substream = require('load').compiler(library);

exports.server = function server(primus) {
  var SubStream = substream(require('stream'))
    , Spark = primus.Spark;

  /**
   * Collection of SubStreams.
   *
   * @type {Object}
   * @api private
   */
  Spark.prototype.streams = {};

  /**
   * Create a new namespace.
   *
   * @param {String} name Namespace id
   * @returns {Namespace}
   * @api private
   */
  Spark.prototype.substream = function substream(name) {
    return this.streams[name] || new SubStream(this, name);
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
    return this.streams[name] || new SubStream(this, name, {
      proxy: [ 'offline', 'online', 'timeout', 'reconnecting', 'open', 'reconnect' ]
    });
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
