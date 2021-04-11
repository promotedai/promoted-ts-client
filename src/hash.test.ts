import { combineHash, hashCode } from './hash';

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
