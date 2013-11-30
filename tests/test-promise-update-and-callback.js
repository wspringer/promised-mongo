var assert = require('assert');
var insert = require('./insert');

insert([{
	hello:'world'
}], function(db, done) {
	var sync = true;
	db.a.update({hello:'world'}, {$set:{hello:'verden'}})
		.then(function() {
			assert.ok(!sync);
			done();
		})
		.done();
	sync = false;
});