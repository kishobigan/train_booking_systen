'use strict';
function isValidSegment(originSequence, destinationSequence) {
  return (
    Number.isInteger(originSequence) &&
    Number.isInteger(destinationSequence) &&
    originSequence >= 0 &&
    destinationSequence > originSequence
  );
}
function createSegment(originSequence, destinationSequence) {
  if (!isValidSegment(originSequence, destinationSequence))
    throw new TypeError(
      'A segment requires non-negative integer sequences with origin before destination'
    );
  return Object.freeze({ originSequence, destinationSequence });
}
function normalize(segment) {
  if (!segment || !isValidSegment(segment.originSequence, segment.destinationSequence))
    throw new TypeError('Invalid segment');
  return segment;
}
function segmentsOverlap(segmentA, segmentB) {
  const a = normalize(segmentA);
  const b = normalize(segmentB);
  return a.originSequence < b.destinationSequence && a.destinationSequence > b.originSequence;
}
function segmentsAreAdjacent(segmentA, segmentB) {
  const a = normalize(segmentA);
  const b = normalize(segmentB);
  return a.destinationSequence === b.originSequence || b.destinationSequence === a.originSequence;
}
function segmentContains(containerSegment, containedSegment) {
  const container = normalize(containerSegment);
  const contained = normalize(containedSegment);
  return (
    container.originSequence <= contained.originSequence &&
    container.destinationSequence >= contained.destinationSequence
  );
}
module.exports = {
  isValidSegment,
  createSegment,
  segmentsOverlap,
  segmentsAreAdjacent,
  segmentContains,
};
