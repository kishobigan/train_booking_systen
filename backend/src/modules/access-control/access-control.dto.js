'use strict';
module.exports = {
  assignmentDto: (body = {}) => ({ journeyId: body.journeyId, stationId: body.stationId }),
};
