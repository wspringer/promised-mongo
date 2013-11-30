<a href="http://promises-aplus.github.com/promises-spec">
    <img src="http://promises-aplus.github.com/promises-spec/assets/logo-small.png"
         align="right" alt="Promises/A+ logo" />
</a>

# promised-mongo

A slight rewrite of [mongojs](https://github.com/mafintosh/mongojs) to support promises.  Fully
backwardly-compatible with mongojs, but all functions that accept callbacks now return promises too.
Promises are [Promises/A+](http://promises-aplus.github.io/promises-spec/) compatible, so you are free
to use [any compatible promise library](https://github.com/promises-aplus/promises-spec/blob/master/implementations.md).
The promise library used by this project is [Q](https://github.com/kriskowal/q).

## Install

promised-mongo is available through [npm](http://npmjs.org):

	npm install promised-mongo

## Usage

Use promised-mongo just like mongojs, except you can also use the returned promise instead of the
callback.  Note that a promise isn't returned if a callback is specified.

```js
var pmongo = require('promised-mongo');
var db = pmongo(connectionString, [collections]);
```

The connection string should follow the format desribed in [the mongo connection string docs](http://docs.mongodb.org/manual/reference/connection-string/).
Some examples of this could be:

``` js
// simple usage for a local db
var db = pmongo('mydb', ['mycollection']);

// the db is on a remote server (the port default to mongo)
var db = pmongo('example.com/mydb', ['mycollection']);

// we can also provide some credentials
var db = pmongo('username:password@example.com/mydb', ['mycollection']);

// connect now, and worry about collections later
var db = pmongo('mydb');
var mycollection = db.collection('mycollection');
```

After we connected we can query or update the database just how we would using the mongo API with the exception that we use a callback
The format for callbacks is always `callback(error, value)` where error is null if no exception has occured.

``` js
// find everything
db.mycollection.find().then(function(docs) {
	// docs is an array of all the documents in mycollection
});

// find everything, but sort by name
db.mycollection.find().sort({name:1}).toArray().then(function(docs) {
	// docs is now a sorted array
});

// iterate over all whose level is greater than 90.  This still needs a callback,
// because a promise can't be resolved multiple times.
db.mycollection.find({level:{$gt:90}}).forEach(function(err, doc) {
	if (!doc) {
		// we visited all docs in the collection
		return;
	}
	// doc is a document in the collection
});

// find a document using a native ObjectId
db.mycollection.findOne({
	_id:pmongo.ObjectId('523209c4561c640000000001')
}).then(function(doc) {
	// doc._id.toString() === '523209c4561c640000000001'
});

// find all named 'mathias' and increment their level
db.mycollection.update({name:'mathias'}, {$inc:{level:1}}, {multi:true}).then(function() {
	// the update is complete
});

// find one named 'mathias', tag him as a contributor and return the modified doc
db.mycollection.findAndModify({
	query: { name: 'mathias' },
	update: { $set: { tag:'maintainer' } },
	new: true
}).then(function(doc) {
	// doc.tag === 'maintainer'
});


// use the save function to just save a document
db.mycollection.save({created:'just now'});

```

If you provide a callback to `find` or any cursor config operation promised-mongo will call `toArray` for you

``` js
db.mycollection.find({}, function(err, docs) { ... });

db.mycollection.find({}).limit(2).skip(1, function(err, docs) { ... });
```
is the same as

``` js
db.mycollection.find({}).toArray(function(err, docs) { ... });

db.mycollection.find({}).limit(2).skip(1).toArray(function(err, docs) { ... });
```

For more detailed information about the different usages of update and quering see [the mongo docs](http://www.mongodb.org/display/DOCS/Manual)

## Streaming cursors

As of `0.7.0` all cursors are a [readable stream](http://nodejs.org/api/stream.html#stream_readable_stream) of objects.

``` js
var JSONStream = require('JSONStream');

// pipe all documents in mycollection to stdout
db.mycollection.find({}).pipe(JSONStream.stringify()).pipe(process.stdout);
```

Notice that you should pipe the cursor through a stringifier (like [JSONStream](https://github.com/dominictarr/JSONStream))
if you want to pipe it to a serial stream like a http response.

## Tailable cursors

If you are using a capped collection you can create a [tailable cursor](http://docs.mongodb.org/manual/tutorial/create-tailable-cursor/) to that collection by adding `tailable:true` to the find options

``` js
var cursor = db.mycollection.find({}, {}, {tailable:true, timeout:false});

// since all cursors are streams we can just listen for data
cursor.on('data', function(doc) {
	console.log('new document', doc);
});
```

Note that you need to explicitly set the selection parameter in the `find` call.

## Database commands

With promised-mongo you can run database commands just like with the mongo shell using `db.runCommand()`

```js
db.runCommand({ping:1}).then(function(res) {
	if(res.ok) console.log("we're up");
});
```

or `db.collection.runCommand()`

```js
db.things.runCommand('count').then(function(res) {
	console.log(res);
});
```

## Replication Sets

Promised-mongo can also connect to a mongo replication set by providing a connection string with multiple hosts

``` js
var db = pmongo('rs-1.com,rs-2.com,rs-3.com/mydb?slaveOk=true', ['mycollection']);
```

For more detailed information about replica sets see [the mongo replication docs](http://www.mongodb.org/display/DOCS/Replica+Sets)

## Maintenance

I aim to try to keep up to date with changes in mongojs.  Version numbers will stay equivalent, and
I won't be adding any additional features not supported by mongojs.  Bug reports and pull requests
welcome.