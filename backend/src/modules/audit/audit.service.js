'use strict';
const AuditRepository = require('./audit.repository');
class AuditService {
  constructor(repository = new AuditRepository()) {
    this.repository = repository;
  }
  /** Persist an audit event in the caller's transaction. */
  record(event, options = {}) {
    return this.repository.create(event, options);
  }
}
module.exports = AuditService;
