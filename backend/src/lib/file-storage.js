'use strict';
const { mkdir, writeFile, unlink, readFile } = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
class LocalFileStorageProvider {
  constructor(root) {
    this.root = path.resolve(root);
  }
  async upload({ buffer, extension = '' }) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = `${randomUUID()}${extension}`;
    await writeFile(path.join(this.root, key), buffer, { mode: 0o600, flag: 'wx' });
    return { storageProvider: 'LOCAL_PRIVATE', storageKey: key, storedFileName: key };
  }
  async delete(key) {
    try {
      await unlink(path.join(this.root, path.basename(key)));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  async download(key) {
    return readFile(path.join(this.root, path.basename(key)));
  }
}
module.exports = { LocalFileStorageProvider };
