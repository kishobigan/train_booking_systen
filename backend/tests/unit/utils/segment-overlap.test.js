'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createSegment,
  segmentsOverlap,
  segmentsAreAdjacent,
  segmentContains,
} = require('../../../src/common/utils/segment-overlap');

test('half-open adjacent segments do not overlap', () => {
  const first = createSegment(0, 3);
  const second = createSegment(3, 6);
  assert.equal(segmentsAreAdjacent(first, second), true);
  assert.equal(segmentsOverlap(first, second), false);
  assert.equal(segmentsOverlap(createSegment(0, 1), createSegment(1, 2)), false);
});
test('partial, contained, containing and identical segments overlap', () => {
  assert.equal(segmentsOverlap(createSegment(0, 3), createSegment(2, 5)), true);
  assert.equal(segmentsOverlap(createSegment(1, 5), createSegment(2, 4)), true);
  assert.equal(segmentsOverlap(createSegment(2, 4), createSegment(1, 5)), true);
  assert.equal(segmentsOverlap(createSegment(0, 6), createSegment(0, 6)), true);
  assert.equal(segmentContains(createSegment(1, 5), createSegment(2, 4)), true);
});
test('invalid reversed, zero-length, negative and non-integer segments are rejected', () => {
  assert.throws(() => createSegment(3, 2), TypeError);
  assert.throws(() => createSegment(2, 2), TypeError);
  assert.throws(() => createSegment(-1, 2), TypeError);
  assert.throws(() => createSegment(0.5, 2), TypeError);
});
