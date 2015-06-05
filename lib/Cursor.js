import Promise from 'bluebird';
import {Readable} from 'readable-stream';
import _ from 'lodash';


export default class Cursor extends Readable {

  constructor(collection, namespace, command, options) {
    super({objectMode: true, highWaterMark: 0});
    this.db = collection.db;
    this.collection = collection;
    this.namespace = namespace;
    this.command = command;
    this.options = options;
  }


  batchSize(n) {
    this.command.batchSize = n;
    return this;
  }


  async connect() {
    if (!this._cursor) {
      this._cursor = (await this.db.connect()).cursor(this.namespace, this.command, this.options);
    }
    return this._cursor;
  }


  async count() {
    let result = await this.collection.runCommand('count', {query: this.command.query});
    return result.n;
  }


  async destroy() {
    if (this.cursor) {
      cursor.close();
    }
  }


  async explain() {
    this.command.query = {$query: this.command.query || {}, $explain: 1};
    return await this.next();
  }


  async forEach(action) {
    let item = null;

    while (item = await this.next()) {
      action(item);
    }
  }


  limit(n) {
    this.command.limit = n;
    return this;
  }


  async map(mapFunction) {
    let result = [];
    let item = null;

    while (item = await this.next()) {
      result.push(mapFunction(item));
    }

    return result;
  }


  async next() {
    let cursor = await this.connect();

    return await new Promise(function (resolve, reject) {
      cursor.next(function (error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
      });
    });
  }


  async rewind() {
    let cursor = await this.connect();
    cursor.rewind();
  }


  async size() {
    let options = _.pick(this.command, ['query','limit','skip']);
    let result = await this.collection.runCommand('count', options);
    return result.n;
  }


  skip(n) {
    this.command.skip = n;
    return this;
  }


  sort(sortObject) {
    this.command.sort = sortObject;
    return this;
  }


  then() {
    // allows awaiting collection.find() directly.
    let promise = this.toArray();
    return promise.then.apply(promise, Array.prototype.slice.call(arguments));
  }


  async toArray() {
    let result = [];
    let item = null;

    while (item = await this.next()) {
      result.push(item);
    }

    return result;
  }


  _read() {
    let self = this;
    self.next().then(function (data) {
      self.push(data);
    }, function (error) {
      self.emit('error', error);
    })
  }
};
