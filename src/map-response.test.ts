import type { Insertion } from './types/delivery';
import { toContents, toContentsWithoutInsertionId } from './map-response';

const insertion = (contentId: string, insertionId: string): Insertion => ({
  contentId,
  insertionId,
});

type Content = {
  name: string;
  insertionId: string | undefined | null;
};

describe('toContents', () => {
  it('empty', () => {
    expect(toContents([], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = { a: { name: 'a', insertionId: undefined } };
    expect(toContents<Content>([], contentLookup)).toEqual([]);
  });

  it('empty contentLookup', () => {
    expect(toContents<Content>([insertion('content1', 'uuid1')], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, Content> = {
      '1': { name: 'a', insertionId: undefined },
      '2': { name: 'b', insertionId: undefined },
      '3': { name: 'c', insertionId: undefined },
    };
    const insertions: Insertion[] = [
      insertion('2', 'uuid1'),
      insertion('4', 'uuid2'),
      insertion('3', 'uuid3'),
      insertion('', 'uuid4'),
    ];
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

type ContentWithoutInsertion = {
  name: string;
};

describe('toContentsWithoutInsertionId', () => {
  it('empty', () => {
    expect(toContentsWithoutInsertionId([], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, ContentWithoutInsertion> = { a: { name: 'a' } };
    expect(toContentsWithoutInsertionId<ContentWithoutInsertion>([], contentLookup)).toEqual([]);
  });

  it('empty contentLookup', () => {
    expect(toContentsWithoutInsertionId<ContentWithoutInsertion>([insertion('content1', 'uuid1')], {})).toEqual([]);
  });

  it('empty array', () => {
    const contentLookup: Record<string, ContentWithoutInsertion> = {
      '1': { name: 'a' },
      '2': { name: 'b' },
      '3': { name: 'c' },
    };
    const insertions: Insertion[] = [
      insertion('2', 'uuid1'),
      insertion('4', 'uuid2'),
      insertion('3', 'uuid3'),
      insertion('', 'uuid4'),
    ];
    expect(toContentsWithoutInsertionId<ContentWithoutInsertion>(insertions, contentLookup)).toEqual([
      {
        name: 'b',
      },
      {
        name: 'c',
      },
    ]);
  });
});
