import { combineHash, hashCode, mod } from './hash';

it('empty', () => {
  expect(hashCode('')).toEqual(0);
});

it('simple', () => {
  expect(hashCode('HOLD_OUT')).toEqual(268162990);
  expect(hashCode('HOLD_OUT2')).toEqual(-276881852);
  expect(hashCode('HOLD_OUT3')).toEqual(-276881851);
  expect(hashCode('EXP1')).toEqual(2142676);
});

it('combineHash', () => {
  expect(combineHash(268162990, -276881852)).toEqual(8036187175);
  expect(combineHash(268162990, 2142660)).toEqual(8315211687);
});

it('mod', () => {
  expect(mod(0, 10)).toEqual(0);
  expect(mod(5, 10)).toEqual(5);
  expect(mod(10, 10)).toEqual(0);
  expect(mod(15, 10)).toEqual(5);
  expect(mod(13123011, 10)).toEqual(1);
  expect(mod(-1, 10)).toEqual(9);
  expect(mod(-5, 10)).toEqual(5);
  expect(mod(-10, 10)).toEqual(0);
  expect(mod(-234123, 10)).toEqual(7);
});
