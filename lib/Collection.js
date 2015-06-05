import _ from 'lodash';
import mongodb from 'mongodb-core';
import Cursor from './Cursor';
import AggregationCursor from './AggregationCursor';
import Bulk from './Bulk';


const Code = mongodb.BSON.Code;
const ObjectID = mongodb.BSON.ObjectID;


var indexName = function(index) {
  return Object.keys(index).map(function(key) {
    return key + '_' + index[key];
  }).join('_');
};


export default class Collection {
  constructor(db, collectionName) {
    this.db = db;
    this.collectionName = collectionName;
    this.fullCollectionName = db.config.dbName + '.' + collectionName;
    this.defaultWriteOptions = { writeConcern: db.writeConcern, ordered: true };
  }


  async aggregate() {
    let pipeline = Array.prototype.slice.call(arguments);
    return (await this.runCommand('aggregate', {pipeline})).result;
  }


  aggregateCursor() {
    let pipeline = Array.prototype.slice.call(arguments);
    return new Cursor(this, this.fullCollectionName, {
      aggregate: this.collectionName,
      pipeline: pipeline,
      cursor: {batchSize: 1000}
    }, {cursor: {batchSize: 1000}});
  }


  async count(query) {
    return await this.find(query).count();
  }


  async createIndex(index, options) {
    options = _.extend({name: indexName(index), key: index}, options || {});
    return await this.runCommand('createIndexes', {indexes: [options]});
  }


  async distinct(key, query) {
    return (await this.runCommand('distinct', {key, query})).values;
  }


  async drop() {
    try {
      await this.runCommand('drop');
      return true;
    } catch (e) {
      if (e.name === 'MongoError' && e.message === 'ns not found') {
        return false;
      } else {
        throw e;
      }
    }
  }


  async dropIndex(index) {
    return await this.runCommand('dropIndexes', {index});
  }


  async dropIndexes() {
    return await this.runCommand('dropIndexes', {index: '*'});
  }


  async ensureIndex(index, options) {
    return await this.createIndex(index, options);
  }


  find(query, projection, options) {
    query = query || {};
    projection = projection || null;

    options = _.extend({
      find: this.collectionName,
      query: query,
      fields: projection
    }, options || {});

    return new Cursor(this, this.fullCollectionName, options);
  }


  async findAndModify(options) {
    let result = await this.runCommand('findAndModify', options);
    if (!result.lastErrorObject) {
      result.lastErrorObject = { n : 0 };
    }
    return result;
  }


  async findOne(query, projection) {
    let cursor = this.find.apply(this, arguments).limit(1);
    let result = await cursor.next();
    return result;
  }


  async getIndexes() {
    let ns = this.db.config.dbName + '.system.indexes';
    return await new Cursor(this, ns, {
      find: ns,
      query: {ns: this.fullCollectionName},
      projection: {}
    }).toArray();
  }


  async group(doc) {
    let cmd = {
      group: {
        ns: this.collectionName,
        key: doc.key,
        initial: doc.initial,
        $reduce: new Code(doc.reduce.toString()),
        out: 'inline',
        cond: doc.cond
      }
    };

    if (doc.finalize) {
      cmd.group.finalize = new Code(doc.finalize.toString());
    }
    if (doc.keys) {
      cmd.group.$keyf = new Code(doc.keys.toString());
    }

    return (await this.db.runCommand(cmd)).retval;
  }


  initializeOrderedBulkOp = function () {
    return new Bulk(this, true);
  }


  initializeUnorderedBulkOp = function () {
    return new Bulk(this, false);
  }


  async insert(docs) {
    let self = this;
    let docList = docs;

    if (!Array.isArray(docs)) {
      docList = [docs];
    }

    for (let i = 0; i < docList.length; ++i) {
      if (!docList[i]._id) {
        docList[i]._id = ObjectID.createPk();
      }
    }

    let server = await self.db.connect();

    return await new Promise(function (resolve, reject) {
      server.insert(self.fullCollectionName, docList, self.defaultWriteOptions,
        function (error) {
          if (error) {
            reject(error);
          } else {
            resolve(docs);
          }
        }
      );
    });
  }


  async isCapped() {
    let ns = this.db.config.dbName + '.system.namespaces';
    let result = await new Cursor(this, ns, {
      find: ns,
      query: {name: this.fullCollectionName},
      projection: {}
    }).toArray();

    return !!(result[0].options && result[0].options.capped);
  }


  async mapReduce(map, reduce, options) {
    options = options || {};
    return await this.runCommand('mapReduce', {
      map: map.toString(),
      reduce: reduce.toString(),
      query: options.query || {},
      out: options.out
    });
  }


  async reIndex() {
    return await this.runCommand('reIndex');
  }


  async remove(query, justOne) {
    if (arguments.length === 0) {
      query = {};
    }
    if (arguments.length < 2) {
      justOne = false;
    }

    let self = this;
    let server = await self.db.connect();

    return await new Promise(function (resolve, reject) {
      server.remove(self.fullCollectionName, [{q: query, limit: justOne ? 1 : 0}], self.defaultWriteOptions,
        function (error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result.result);
          }
        }
      );
    });
  }


  async runCommand(command, options) {
    let temp = {};
    temp[command] = this.collectionName;
    options = _.extend(temp, options || {});
    return await this.db.runCommand(options);
  }


  async save(doc) {
    if (doc._id) {
      await this.update({_id: doc._id}, doc, { upsert: true });
      return doc;
    } else {
      return await this.insert(doc);
    }
  }


  async stats() {
    return await this.runCommand('collStats');
  }


  toString() {
    return this.collectionName;
  }


  async update(query, update, options) {
    let self = this;
    if (!options) {
      options = {};
    }

    let server = await self.db.connect();

    return await new Promise(function (resolve, reject) {
      options = _.extend({q: query, u: update}, options);
      server.update(self.fullCollectionName, [options], self.defaultWriteOptions,
        function (error, result) {
          if (error) {
            reject(error);
          } else {
            result = result.result;
            // backwards compatibility
            if (!result.updatedExisting && result.nModified === result.n) {
              result.updatedExisting = true;
            }
            resolve(result);
          }
        }
      );
    });
  }
};
