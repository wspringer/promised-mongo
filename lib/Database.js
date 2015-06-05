import Promise from 'bluebird';
import mongodb from 'mongodb-core';
import parseConnectionString from 'parse-mongo-url';
import _ from 'lodash';

import Collection from './Collection';
import Cursor from './Cursor';


const Server = mongodb.Server;
const ReplSet = mongodb.ReplSet;
const MongoCR = mongodb.MongoCR;

export default class Database {
  constructor(connectionString, collections) {
    let self = this;
    self.config = parseConnectionString(connectionString);

    let db_options = self.config.db_options;
    let writeConcern = { w: 1 };

    if (db_options) {
      writeConcern = _.pick(db_options, ['w', 'j', 'fsync', 'wtimeout']);

      if (!writeConcern.w) {
        writeConcern.w = 1;
      }
    }

    Object.defineProperty(self, 'writeConcern', {
      writable: false,
      value: writeConcern
    });

    if (collections) {
      collections.forEach(function (collection) {
        self[collection] = self.collection(collection);

        // set up members to enable db.foo.bar.collection
        let parts = collection.split('.');
        let last = parts.pop();
        let parent = parts.reduce(function (parent, currentPart) {
          return parent[currentPart] = parent[currentPart] || {};
        }, self);

        parent[last] = self.collection(last);
      });
    }
  }


  async addUser(user) {
    return await createUser(user);
  }


  async close() {
    let self = this;
    // don't open a connection just to close it again
    if (self._serverPromise) {
      (await self._serverPromise).destroy();
      self._serverPromise = null;
    }
  }


  collection(collectionName) {
    return new Collection(this, collectionName);
  }


  connect() {
    let self = this;

    // only connect once
    if (self._serverPromise) {
      return self._serverPromise;
    } else {
      return self._serverPromise = new Promise(function (resolve, reject) {
        let options = null, server = null;
        let config = self.config;

        // create server connection for single server or replica set
        if (config.servers.length === 1) {
          options = config.server_options;
          options.host = config.servers[0].host || 'localhost';
          options.port = config.servers[0].port || 27017;
          options.reconnect = true;
          options.reconnectInterval = 50;
          server = new Server(options);
        } else {
          options = config.rs_options;
          options.setName = options.rs_name;
          options.reconnect = true;
          options.reconnectInterval = 50;
          server = new ReplSet(config.servers, options);
        }

        if (config.auth) {
          server.addAuthProvider('mongocr', new MongoCR());
          // authenticate on connect
          server.on('connect', function (server) {
            server.auth('mongocr', config.dbName, config.auth.user, config.auth.password,
              function (error, server) {
                if (error) {
                  reject(error);
                } else {
                  resolve(server);
                }
              });
          });
        } else {
          server.on('connect', function (server) {
            resolve(server);
          });
        }

        server.on('error', function (error) {
          reject(error);
        });

        server.connect();
      });
    }
  }


  async createCollection(name, options) {
    let cmd = _.extend({create: name}, options || {});
    return await this.runCommand(cmd);
  }


  async createUser(user) {
    // sanity check args
    if (typeof user !== 'object') {
      throw new Error('user param should be an object');
    }
    let cmd = _.extend({createUser: user.user}, user);
    delete cmd.user;
    return await this.runCommand(cmd);
  }


  async dropDatabase() {
    return await this.runCommand('dropDatabase');
  }


  async dropUser(username) {
    return await this.runCommand({dropUser: username});
  }


  async getCollectionNames() {
    let collection = this.collection('system.namespaces');
    let names = await collection.find({name:/^((?!\$).)*$/}).toArray();
    return names.map(function (name) {
      // trim dbname from front of collection name
      return name.name.substr(name.name.indexOf('.')+1);
    });
  }


  async getLastError() {
    return (await this.runCommand('getLastError')).err;
  }


  async getLastErrorObj() {
    return await this.getLastError();
  }


  async removeUser(username) {
    return await this.dropUser(username);
  }


  async runCommand(options) {
    let self = this;

    if (typeof options === 'string') {
      let cmd = options;
      options = {};
      options[cmd] = 1;
    }

    let server = await self.connect();

    return await new Promise(function (resolve, reject) {
      server.command(self.config.dbName + '.$cmd', options,
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


  runCommandCursor(command, options) {
    if (!options) {
      options = {};
      options[command] = 1;
    }
    let ns = '$cmd.' + command;
    let collection = new Collection(this, ns);
    return new Cursor(collection, this.config.dbName + '.' + ns, options);
  }


  async stats(scale) {
    if (scale === undefined) {
      scale = 1;
    }
    return await this.runCommand({dbStats: 1, scale: scale});
  }


  async toString() {
    return this.config.dbName;
  }
};
