'use strict';

class BootstrapState {
  constructor() {
    this.accessToken = null;
    this.cookie = null;
    this.temporaryCredentials = new Map();
  }
  clear() {
    this.accessToken = null;
    this.cookie = null;
    this.temporaryCredentials.clear();
  }
}

module.exports = BootstrapState;
