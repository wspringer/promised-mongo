var Database = require('./dist/Database');
var Collection = require('./dist/Collection');
var mongodb = require('mongodb-core');
var coreJs = require('babel-runtime/core-js').default;


function createDatabase(connectionString, collections) {
  var db = new Database(connectionString, collections);
  var ret;

  if (typeof Proxy !== 'undefined') {
    ret = Proxy.create({
      get: function (object, property) {
        if (db[property]) {
          return db[property];
        } else {
          return db[property] = db.collection(property);
        }
      }
    });
  } else {
    ret = db;
  }

  ret.ObjectId = mongodb.BSON.ObjectId;
  ret.DBRef = mongodb.BSON.DBRef;
  ret.Timestamp = mongodb.BSON.Timestamp;
  ret.MinKey = mongodb.BSON.MinKey;
  ret.MaxKey = mongodb.BSON.MaxKey;
  ret.NumberLong = mongodb.BSON.Long;

  return ret;
}


module.exports = createDatabase;

createDatabase.compatible = function () {
  coreJs.Promise.prototype.done = function (resolve, reject) {
    this.then(
      function (result) {
        try {
          if (resolve) {
            resolve(result);
          }
        } catch (err) {
          process.nextTick(function () { throw err; });
        }
      },
      function (err) {
        if (reject) {
          reject(err);
        } else {
          process.nextTick(function () { throw err; });
        }
      });
  };

  coreJs.Promise.prototype.fail = coreJs.Promise.prototype.catch;

  coreJs.Promise.prototype.fin = coreJs.Promise.prototype.finally = function (callback) {
      return this.then(callback, function (err) { callback(); throw err; });
  };

  var findAndModify = Collection.prototype.findAndModify;
  Collection.prototype.findAndModifyEx = findAndModify;

  Collection.prototype.findAndModify = function () {
    return findAndModify.apply(this, Array.prototype.slice.call(arguments))
      .then(function (result) {
        return result.result;
      });
  };

  return this;
};


createDatabase.ObjectId = mongodb.BSON.ObjectId;
createDatabase.DBRef = mongodb.BSON.DBRef;
createDatabase.Timestamp = mongodb.BSON.Timestamp;
createDatabase.MinKey = mongodb.BSON.MinKey;
createDatabase.MaxKey = mongodb.BSON.MaxKey;
createDatabase.NumberLong = mongodb.BSON.Long;
