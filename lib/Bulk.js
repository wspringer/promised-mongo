import mongodb from 'mongodb-core';


export default class Bulk {

  constructor(collection, ordered) {
    this.collection = collection;
    this.ordered = ordered;
    this._currentCommand = null;
    this._commands = [];
  }


  async execute() {
    let self = this;
    let result = {
      writeErrors: [],
      writeConcernErrors: [],
      nInserted: 0,
      nUpdated: 0,
      nMatched: 0,
      nModified: 0,
      nRemoved: 0,
      upserted: []
    };

    self._commands.push(self._currentCommand);

    for (let i = 0; i < self._commands.length; ++i) {
      let cmd = self._commands[i];
      let cmdResult = await self.collection.db.runCommand(cmd);

      if (cmd.update) {
        result.nUpdated += cmdResult.result.n;
      } else if (cmd.insert) {
        result.nInserted += cmdResult.result.n;
      } else if (cmd.delete) {
        result.nRemoved += cmdResult.result.n;
      }
    }

    result.ok = 1;
    return result;
  }


  async find(query) {
    let findObject = {};
    let self = this;

    let remove = function (limit) {
      if (!self._currentCommand) {
        self._currentCommand = {
          delete: self.collection.collectionName,
          deletes: [],
          ordered: self.ordered,
          writeConcern: {w: 1}
        };
      }
      else if (!self._currentCommand.delete) {
        self._commands.push(self._currentCommand);
        self._currentCommand = {
          delete: self.collection.collectionName,
          deletes: [],
          ordered: self.ordered,
          writeConcern: {w: 1}
        };
      }
      self._currentCommand.deletes.push({q: query, limit: limit});
    };

    let update = function (updateObject, multiple) {
      if (!self._currentCommand) {
        self._currentCommand = {
          update: self.collection.collectionName,
          updates: [],
          ordered: self.ordered,
          writeConcern: {w: 1}
        };
      }
      else if (!self._currentCommand.update) {
        self._commands.push(self._currentCommand);
        self._currentCommand = {
          update: self.collection.collectionName,
          updates: [],
          ordered: self.ordered,
          writeConcern: {w: 1}
        };
      }
      self._currentCommand.updates.push({q: query, u: updateObject, multi: mulitple, upsert: false});
    };

    findObject.remove = function () { remove(0); }
    findObject.removeOne = function () { remove(1); }
    findObject.update = function (updateObject) { update(updateObject, true); }
    findObject.updateOne = function (updateObject) { update(updateObject, false); }

    return findObject;
  }


  insert(doc) {
    let self = this;

    if (!self._currentCommand) {
      self._currentCommand = {
        insert: self.collection.collectionName,
        documents: [],
        ordered: self.ordered,
        writeConcern: {w: 1}
      };
    }
    else if (!self._currentCommand.insert) {
      self._commands.push(self._currentCommand);
      self._currentCommand = {
        insert: self.collection.collectionName,
        documents: [],
        ordered: self.ordered,
        writeConcern: {w: 1}
      };
    }

    if (!doc._id) {
      doc._id = mongodb.BSON.ObjectID.createPk();
    }
    this._currentCommand.documents.push(doc);
  }


  tojson() {
    let result = {
      nInsertOps: 0,
      nUpdateOps: 0,
      nRemoveOps: 0,
      nBatches: this._commands.length
    };

    this._commands.forEach(function (cmd) {
      if (cmd.update) {
        result.nUpdateOps += cmd.updates.length;
      } else if (cmd.insert) {
        result.nInsertOps += cmd.documents.length;
      } else if (cmd.delete) {
        result.nRemoveOps += cmd.deletes.length;
      }
    });

    return result;
  }
};
