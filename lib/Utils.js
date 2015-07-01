import {MongoError} from 'mongodb-core';


export function toError(error) {
  if (error instanceof Error) {
    return error;
  }

  var msg = error.err || error.errmsg || error.errMessage || error;
  let e = new MongoError(msg);

  // Get all object keys
  let keys = typeof error == 'object' ? Object.keys(error) : [];

  if (typeof error === 'object') {
    let keys = Object.keys(error);

    for(let i = 0; i < keys.length; i++) {
      e[keys[i]] = error[keys[i]];
    }
  }

  return e;
};
