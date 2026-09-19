import { db } from './db.js';
import { seedIfEmpty } from './seed.js';

let readyPromise = null;

export function ready() {
  if (!readyPromise) {
    readyPromise = db.open().then(() => seedIfEmpty(db));
  }
  return readyPromise;
}

export { db };
