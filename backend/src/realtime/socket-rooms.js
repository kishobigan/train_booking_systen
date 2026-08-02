'use strict';
const buildSeatMapRoom = ({ journeyId, originSequence, destinationSequence }) =>
  `seatmap:${journeyId}:${originSequence}:${destinationSequence}`;
const parseSeatMapRoom = (roomName) => {
  const match = /^seatmap:([^:]+):(\d+):(\d+)$/.exec(roomName);
  return (
    match && {
      roomName,
      journeyId: match[1],
      originSequence: Number(match[2]),
      destinationSequence: Number(match[3]),
    }
  );
};
const segmentsOverlap = (left, right) =>
  left.originSequence < right.destinationSequence &&
  left.destinationSequence > right.originSequence;
module.exports = { buildSeatMapRoom, parseSeatMapRoom, segmentsOverlap };
