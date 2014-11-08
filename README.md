# SubStream

[![Version npm](http://img.shields.io/npm/v/substream.svg?style=flat-square)](http://browsenpm.org/package/substream)[![Build Status](http://img.shields.io/travis/primus/substream/master.svg?style=flat-square)](https://travis-ci.org/primus/substream)[![Dependencies](https://img.shields.io/david/primus/substream.svg?style=flat-square)](https://david-dm.org/primus/substream)[![Coverage Status](http://img.shields.io/coveralls/primus/substream/master.svg?style=flat-square)](https://coveralls.io/r/primus/substream?branch=master)[![IRC channel](http://img.shields.io/badge/IRC-irc.freenode.net%23primus-00a8ff.svg?style=flat-square)](http://webchat.freenode.net/?channels=primus)

SubStream is a simple stream multiplexer for [Primus]. It allows you to create
simple message channels which only receive the information you send to it. These
channels are in fact, streams, which is why this module is called `SubStreams`
because it adds small streams on top of the main stream and intercepts them.

## Installation

```bash
npm install --save substream
```

The module can only be used in conjunction with [Primus] so make sure that your
application is using that as its real-time backend.

## Getting started

In all the code examples, we assume that the following code is present:

```js
'use strict';

var Primus = require('primus')
  , http = require('http');

var server = http.createServer()
  , primus = new Primus(server);

//
// Custom code here, just above the listen call.
//

server.listen(8080);
```

Which is the most minimal bootstrapping code required to create a [Primus]
powered server. Once you've setup the server you need to add `SubStream` as
a plugin in to [Primus]:

```js
//
// The `primus.use` method adds the plugin to primus. It requires a unique
// name in order to easily retrieve it again. For the
// sake of clarity, we're going to use 'substream' as the name.
//
primus.use('substream', require('substream'));
```

After you've added plugins, you might want to re-compile the client library that
[Primus] serves, as it automatically adds the client-side plugin to the framework,
as well as the custom `substream.js` library to create the actual name spaces. To
save the client just run:

```js
primus.save(__dirname +'/primus.js');
```

But this is only needed if you serve the file manually and not through the
automatically generated `/primus/primus.js` path (which is regenerated on the fly).
Now that we've set everything up correctly we can start creating some substreams.

### The client

To create or access a `substream` in the [Primus] client start off with making
a connection:

```js
var primus = new Primus('http://<your url here:whateverportnumber>');

var foo = primus.substream('foo');
```

The `substream` method automatically creates a namespaced stream if you didn't
create it before. Or, it will return your previously created stream when you call
it again. So now we have a `foo` stream we can just write to:

```js
foo.write('data');
```

Awesome, all works as intended. But this was just one single substream, we can
add more:

```js
var bar = primus.substream('bar')
  , baz = primus.substream('baz');
```

You can create an infinite number of substreams on top of one single base stream.
The data is not leaked between streams. It's all "sandboxed".

As the returned substreams are `streams` or `eventemitters` we can just listen
to `data`, `end` or `close` events. But it also proxies all the other events
that [Primus] emits such as the `reconnect`, `offline` events etc. (The full
list is in the [Primus] README.md). So for receiving and writing data you can just
do:

```js
bar.on('data', function () {

});

bar.write('hello from bar');

foo.on('data', function (data) {
  console.log('recieved data', data);
}).on('end', function () {
  console.log('connection has closed or substream was closed');
});
```

### The server

The server portion of this module isn't that different than the client portion.
It follows the same API stream/eventemitter API:

```js
primus.on('connection', function (spark) {
  var foo = spark.substream('foo')
    , bar = spark.substream('bar')
    , baz = spark.substream('baz');

  foo.on('data', function (data) {
    console.log('foo received:', data);
  });

  //
  // You can even pipe data
  //
  fs.createReadSteam(__dirname + '/example.js').pipe(bar, {
    end: false
  });

  //
  // To stop receiving data, simply end the substream:
  //
  baz.end();
})
```

### FYI's

- When the spark/connection closes all SubStreams will automatically close, this
  only happens for the end event, the close event is proxied.
- We add an extra `streams` object to the spark/connection which contains all
  active SubStreams for the given connection mapped by name->substream-instance

## License

MIT

[Primus]: http://github.com/primus/primus
