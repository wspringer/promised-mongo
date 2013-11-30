var assert = require('assert');
var insert = require('./insert');

insert([{
	hello:'world'
}], function(db, done) {
	db.a.update({hello:'world'}, {$set:{hello:'verden'}})
		.then(function() {
			return db.a.findOne();
		})
		.then(function(doc) {
			assert.equal(doc.hello, 'verden');
			done();
		})
		.done();
});