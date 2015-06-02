/**
 * A wrapper function to switch the parent class which is Streams on the server
 * and EventEmitter3 on the client. This way, we can inherit from both of them.
 *
 * @param {Stream|EventEmitter3} Stream The class that SubStream inherits from.
 * @api public
 */
function factory(Stream) {
  'use strict';

  /**
   * Streams provides a streaming, namespaced interface on top of a regular
   * stream.
   *
   * Options:
   *
   * - proxy: Array of addition events that need to be re-emitted.
   *
   * @constructor
   * @param {Stream} stream The stream that needs we're streaming over.
   * @param {String} name The name of our stream.
   * @param {object} options SubStream configuration.
   * @api public
   */
  function SubStream(stream, name, options) {
    if (!(this instanceof SubStream)) return new SubStream(stream, name, options);

    options = options || {};

    this.readyState = stream.readyState;  // Copy the current readyState.
    this.stream = stream;                 // The underlaying stream.
    this.name = name;                     // The stream namespace/name.
    this.primus = options.primus;         // Primus reference.

    //
    // Register the SubStream on the socket.
    //
    if (!stream.streams) stream.streams = {};
    if (!stream.streams[name]) stream.streams[name] = this;

    Stream.call(this);

    //
    // No need to continue with the execution if we don't have any events that
    // need to be proxied.
    //
    if (!options.proxy) return;

    for (var i = 0, l = options.proxy.length, event; i < l; i++) {
      event = options.proxy[i];
      this.stream.on(event, this.emits(event));
    }
  }

  function Ctor() {}
  Ctor.prototype = Stream.prototype;
  SubStream.prototype = new Ctor();
  SubStream.prototype.constructor = SubStream;

  /**
   * Mirror or Primus readyStates, used internally to set the correct ready state.
   *
   * @type {Number}
   * @private
   */
  SubStream.OPENING = 1;   // We're opening the connection.
  SubStream.CLOSED  = 2;   // No active connection.
  SubStream.OPEN    = 3;   // The connection is open.

  /**
   * Simple emit wrapper that returns a function that emits an event once it's
   * called. This makes it easier for transports to emit specific events. The
   * scope of this function is limited as it will only emit one single argument.
   *
   * @param {String} event Name of the event that we should emit.
   * @param {Function} parser Argument parser.
   * @api public
   */
  SubStream.prototype.emits = function emits(event, parser) {
    var streams = this;

    return function emit(arg) {
      var data = parser ? parser.apply(streams, arguments) : arg;

      streams.emit(event, data);
    };
  };

  /**
   * Write a new message to the streams.
   *
   * @param {Mixed} msg The data that needs to be written.
   * @returns {Boolean}
   * @api public
   */
  SubStream.prototype.write = function write(msg) {
    if (!this.stream) return false;

    this.stream.transforms(this.primus, this, 'outgoing', msg);
    return true;
  };

  /**
   * Actually write the message.
   *
   * @param {Mixed} msg The data that needs to be written.
   * @returns {Boolean}
   * @api private
   */
  SubStream.prototype._write = function write(msg) {
    return this.stream._write({
      substream: this.name,
      args: msg
    });
  };

  /**
   * Close the connection.
   *
   * @param {Mixed} data last packet of data.
   * @param {Boolean} received Send a substream::end message.
   * @returns {SubStream}
   * @api public
   */
  SubStream.prototype.end = function end(msg, received) {
    //
    // The SubStream was already closed.
    //
    if (!(this.stream && this.stream.streams && this.stream.streams[this.name])) {
      return this;
    }

    if (msg) this.write(msg);
    if (!received) this._write('substream::end');

    //
    // As we've closed the stream, unregister our selfs from the `streams`
    // object so we're no longer referenced and used to emit data.
    //
    if (this.stream.streams[this.name]) {
      delete this.stream.streams[this.name];
    }

    //
    // Release references.
    //
    this.stream = null;

    this.emit('close');
    this.emit('end');

    return this.removeAllListeners();
  };

  /**
   * Check if the incoming `data` packet is intended for this stream.
   *
   * @param {Mixed} packet The message that's received by the stream.
   * @returns {Boolean} This packet is handled by the SubStream
   * @api public
   */
  SubStream.prototype.mine = function mine(packet) {
    if ('object' !== typeof packet || packet.substream !== this.name) return false;
    if ('substream::end' === packet.args) return this.end(null, true), true;

    this.stream.transforms(this.primus, this, 'incoming', packet.args);

    return true;
  };

  return SubStream;
}

//
// Expose the wrapper.
//
module.exports = factory;
