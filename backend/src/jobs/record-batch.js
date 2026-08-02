'use strict';
const JobExecutionError = require('../common/errors/JobExecutionError');
async function processRecords(
  ids,
  handler,
  { maxFailures = 25, concurrency = 1, logger = console, recordLabel = 'record' } = {}
) {
  const counters = { found: ids.length, processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const result = await handler(id);
        counters.processed += 1;
        if (result?.skipped) counters.skipped += 1;
        else counters.succeeded += 1;
      } catch (error) {
        counters.processed += 1;
        counters.failed += 1;
        logger.error?.(
          { recordId: id, code: error.code, err: error },
          `${recordLabel} processing failed`
        );
        if (counters.failed >= maxFailures)
          throw new JobExecutionError('Maximum record failure threshold exceeded', {
            cause: error,
          });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length || 1) }, worker));
  return counters;
}
module.exports = processRecords;
