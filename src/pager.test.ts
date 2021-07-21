import type { Insertion, Paging } from './types/delivery';
import { Pager } from './pager';
import { InsertionPageType } from './insertion-page-type';

const pager = new Pager();

describe('apply paging', () => {
  let insertions: Insertion[];

  beforeEach(() => {
    insertions = [
      {
        insertionId: 'uuid0-0',
        requestId: 'uuid0-1',
        viewId: 'uuid0-2',
      },
      {
        insertionId: 'uuid1-0',
        requestId: 'uuid1-1',
        viewId: 'uuid1-2',
      },
      {
        insertionId: 'uuid2-0',
        requestId: 'uuid2-1',
        viewId: 'uuid2-2',
      },
    ];
  });

  it('pages a window when unpaged', () => {
    const paging: Paging = {
      size: 2,
      offset: 1,
    };
    const resIns = pager.applyPaging(insertions, InsertionPageType.Unpaged, paging);
    expect(resIns.length).toEqual(insertions.length - 1);

    // We take a page size of 2 starting at offset 1.
    expect(resIns[0].insertionId).toEqual(insertions[1].insertionId);
    expect(resIns[1].insertionId).toEqual(insertions[2].insertionId);

    // Positions start at offset when Unpaged.
    expect(resIns[0].position).toEqual(1);
    expect(resIns[1].position).toEqual(2);
  });

  it('pages a window when prepaged', () => {
    const paging: Paging = {
      size: 2,
      offset: 1,
    };
    const resIns = pager.applyPaging(insertions, InsertionPageType.PrePaged, paging);
    expect(resIns.length).toEqual(insertions.length - 1);

    // We take a page size of 2 starting at the beginning since prepaged.
    expect(resIns[0].insertionId).toEqual(insertions[0].insertionId);
    expect(resIns[1].insertionId).toEqual(insertions[1].insertionId);

    // Positions start at offset.
    expect(resIns[0].position).toEqual(1);
    expect(resIns[1].position).toEqual(2);
  });

  it('returns everything with no paging provided', () => {
    const resIns = pager.applyPaging(insertions, InsertionPageType.Unpaged);
    expect(resIns.length).toEqual(insertions.length);

    // Should assign positions since they weren't already set.
    expect(resIns[0].position).toEqual(0);
    expect(resIns[1].position).toEqual(1);
    expect(resIns[2].position).toEqual(2);
  });

  it('does not touch positions that are already set', () => {
    insertions[0].position = 100;
    insertions[1].position = 101;
    insertions[2].position = 102;

    const resIns = pager.applyPaging(insertions, InsertionPageType.Unpaged);
    expect(resIns.length).toEqual(insertions.length);

    // Should leave positions alone that were already set, presumably these came from Delivery API.
    expect(resIns[0].position).toEqual(100);
    expect(resIns[1].position).toEqual(101);
    expect(resIns[2].position).toEqual(102);
  });

  it('handles empty input for unpaged', () => {
    const resIns = pager.applyPaging([], InsertionPageType.Unpaged);
    expect(resIns.length).toEqual(0);
  });

  it('handles empty input for prepaged', () => {
    const resIns = pager.applyPaging([], InsertionPageType.PrePaged);
    expect(resIns.length).toEqual(0);
  });

  it('handles empty input when paging provided', () => {
    const paging: Paging = {
      size: 1,
      offset: 1,
    };
    const resIns = pager.applyPaging([], InsertionPageType.Unpaged, paging);
    expect(resIns.length).toEqual(0);
  });

  it('returns everything with huge page size', () => {
    const paging: Paging = {
      size: 100,
      offset: 0,
    };
    const resIns = pager.applyPaging(insertions, InsertionPageType.Unpaged, paging);
    expect(resIns.length).toEqual(insertions.length);
  });

  it('returns everything with invalid page size', () => {
    const paging: Paging = {
      size: -1,
      offset: 0,
    };
    const resIns = pager.applyPaging(insertions, InsertionPageType.Unpaged, paging);
    expect(resIns.length).toEqual(insertions.length);
  });

  it('handles invalid offset by starting at 0', () => {
    const paging: Paging = {
      size: 100,
      offset: -1,
    };
    const resIns = pager.applyPaging(insertions, InsertionPageType.Unpaged, paging);
    expect(resIns.length).toEqual(insertions.length);
    expect(resIns[0].position).toEqual(0);
    expect(resIns[1].position).toEqual(1);
    expect(resIns[2].position).toEqual(2);
  });
});
