import type { Insertion } from './types/delivery';
import { toContentArray, toContentArrayWithoutInsertionId } from './map-response';

const insertion = (contentId: string, insertionId: string): Insertion => ({
  contentId,
  insertionId,
});

type Content = {
  name: string;
  insertionId?: string;
};

describe('toContentArray', () => {
  it('empty', () => {
    expect(toContentArray([], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = { a: { name: 'a' } };
    expect(toContentArray<Content>([], contentLookup)).toEqual([]);
  });

  it('empty contentLookup', () => {
    expect(toContentArray<Content>([insertion('content1', 'uuid1')], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = {
      '1': { name: 'a' },
      '2': { name: 'b' },
      '3': { name: 'c' },
    };
    const insertions: Insertion[] = [insertion('2', 'uuid1'), insertion('4', 'uuid2'), insertion('3', 'uuid3')];
    expect(toContentArray<Content>(insertions, contentLookup)).toEqual([
      {
        name: 'b',
        insertionId: 'uuid1',
      },
      {
        name: 'c',
        insertionId: 'uuid3',
      },
    ]);
  });
});

describe('toContentArrayWithoutInsertionId', () => {
  it('empty', () => {
    expect(toContentArrayWithoutInsertionId([], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = { a: { name: 'a' } };
    expect(toContentArrayWithoutInsertionId<Content>([], contentLookup)).toEqual([]);
  });

  it('empty contentLookup', () => {
    expect(toContentArrayWithoutInsertionId<Content>([insertion('content1', 'uuid1')], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = {
      '1': { name: 'a' },
      '2': { name: 'b' },
      '3': { name: 'c' },
    };
    const insertions: Insertion[] = [insertion('2', 'uuid1'), insertion('4', 'uuid2'), insertion('3', 'uuid3')];
    expect(toContentArrayWithoutInsertionId<Content>(insertions, contentLookup)).toEqual([
      {
        name: 'b',
      },
      {
        name: 'c',
      },
    ]);
  });
});
