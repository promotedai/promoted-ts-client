import type { Insertion } from './types/delivery';
import { toContents, toContentsWithoutInsertionId } from './map-response';

const insertion = (contentId: string, insertionId: string): Insertion => ({
  contentId,
  insertionId,
});

type Content = {
  name: string;
  insertionId?: string;
};

describe('toContents', () => {
  it('empty', () => {
    expect(toContents([], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = { a: { name: 'a' } };
    expect(toContents<Content>([], contentLookup)).toEqual([]);
  });

  it('empty contentLookup', () => {
    expect(toContents<Content>([insertion('content1', 'uuid1')], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = {
      '1': { name: 'a' },
      '2': { name: 'b' },
      '3': { name: 'c' },
    };
    const insertions: Insertion[] = [insertion('2', 'uuid1'), insertion('4', 'uuid2'), insertion('3', 'uuid3')];
    expect(toContents<Content>(insertions, contentLookup)).toEqual([
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

describe('toContentsWithoutInsertionId', () => {
  it('empty', () => {
    expect(toContentsWithoutInsertionId([], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = { a: { name: 'a' } };
    expect(toContentsWithoutInsertionId<Content>([], contentLookup)).toEqual([]);
  });

  it('empty contentLookup', () => {
    expect(toContentsWithoutInsertionId<Content>([insertion('content1', 'uuid1')], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = {
      '1': { name: 'a' },
      '2': { name: 'b' },
      '3': { name: 'c' },
    };
    const insertions: Insertion[] = [insertion('2', 'uuid1'), insertion('4', 'uuid2'), insertion('3', 'uuid3')];
    expect(toContentsWithoutInsertionId<Content>(insertions, contentLookup)).toEqual([
      {
        name: 'b',
      },
      {
        name: 'c',
      },
    ]);
  });
});
