'use strict';
const cron = require('node-cron');
class JobRegistry {
  constructor({ runner, definitions, timezone, logger = console }) {
    Object.assign(this, { runner, definitions, timezone, logger });
    this.tasks = [];
    this.initialized = false;
  }
  start() {
    for (const definition of this.definitions.filter((item) => item.enabled)) {
      const task = cron.schedule(
        definition.cron,
        () =>
          this.runner
            .run({
              jobName: definition.name,
              handler: definition.handler,
              metadata: { schedule: definition.cron },
            })
            .catch((error) =>
              this.logger.error?.(
                { jobName: definition.name, code: error.code },
                'Scheduled job failed'
              )
            ),
        { timezone: this.timezone, noOverlap: false }
      );
      this.tasks.push(task);
      this.logger.info?.(
        { jobName: definition.name, schedule: definition.cron, timezone: this.timezone },
        'Scheduled job registered'
      );
    }
    this.initialized = true;
    return this;
  }
  stop() {
    for (const task of this.tasks) task.stop();
    this.initialized = false;
  }
}
module.exports = JobRegistry;
