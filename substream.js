//
// Wrapper needed to switch between server side based Streams and client side
// based EventEmitter3. This way, we can inherit from all of them.
//
function substream(Stream) {
  'use strict';

  var manual;

  /**
   * Streams provides a streaming, namespaced interface on top of a regular
   * stream.
   *
   * Options:
   * - proxy: Array of addition events that need to be re-emitted.
   *
   * @constructor
   * @param {Stream} stream The stream that needs we're streaming over.
   * @param {String} name The name of our stream.
   * @param {object} option Streams configuration.
   * @api public
   */
  function SubStream(stream, name, options) {
    if (!(this instanceof SubStream)) return new SubStream(stream, name, options);

    options = options || {};

    this.options = options;
    this.stream = stream;               // The underlaying stream
    this.name = name;                   // The stream namespace/name

    //
    // Proxy the events that are emitted through the streams interface.
    //
    this.stream.on('error', this.emits('error'));
    this.stream.on('close', this.emits('close'));
    this.stream.on('end', this.emits('end'));

    //
    // Register the SubStream on the socket.
    //
    if (!stream.streams) stream.streams = {};
    stream.streams[name] = this;

    //
    //
    //
    if (manual) Stream.call(this);

    if (!options.proxy) return;

    for (var i = 0, l = options.proxy.length, event; i < l; i++) {
      event = options.proxy[i];
      this.stream.on(event, this.emits(event));
    }
  }

  try { require('util').inherits(SubStream, Stream); }
  catch (e) {
    manual = true;
    SubStream.prototype = new Stream();
    SubStream.prototype.constructor = SubStream;
  }

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
   * @param {Arguments} ..args.. Stuff that get's written.
   * @returns {Boolean}
   * @api public
   */
  SubStream.prototype.write = function write(msg) {
    return this.stream.write({
      args: Array.prototype.slice.call(arguments),
      name: this.name
    });
  };

  /**
   * Close the connection.
   *
   * @param {Mixed} data last packet of data.
   * @api public
   */
  SubStream.prototype.end = function end(msg) {
    if (msg) this.write(msg);

    //
    // As we've closed the stream, unregister our selfs from the `streams`
    // object so we're no longer referenced and used to emit data.
    //
    if (this.stream.streams[this.name]) {
      delete this.stream.streams[this.name];
    }

    this.emit('close');
    this.emit('end');

    return this;
  };

  /**
   * Check if the incoming `data` packet is intended for this stream.
   *
   * @param {Mixed} packet The message that's received by the stream.
   * @returns {Boolean} This packet is handled by the SubStream
   * @api public
   */
  SubStream.prototype.mine = function mine(packet) {
    if ('object' !== typeof packet || packet.name !== this.name) return false;
    this.emit.apply(this, ['data'].concat(packet.args));

    return true;
  };

  return SubStream;
}
