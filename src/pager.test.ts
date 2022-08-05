import type { Insertion, Paging } from './types/delivery';
import { Pager } from './pager';

const pager = new Pager();

describe('apply paging', () => {
  let insertions: Insertion[];

  beforeEach(() => {
    insertions = [
      {
        contentId: '0',
      },
      {
        contentId: '1',
      },
      {
        contentId: '2',
      },
    ];
  });

  it('pages a window with insertionStart=0', () => {
    const paging: Paging = {
      size: 2,
      offset: 1,
    };
    const resIns = pager.applyPaging(insertions, 0, paging);
    expect(resIns.length).toEqual(insertions.length - 1);

    // We take a page size of 2 starting at offset 1.
    expect(resIns[0].contentId).toEqual(insertions[1].contentId);
    expect(resIns[1].contentId).toEqual(insertions[2].contentId);

    // Positions start at offset when Unpaged.
    expect(resIns[0].position).toEqual(1);
    expect(resIns[1].position).toEqual(2);
  });

  it('creates a short page if necessary at the end', () => {
    const paging: Paging = {
      size: 3,
      offset: 1,
    };
    const resIns = pager.applyPaging(insertions, 0, paging);
    expect(resIns.length).toEqual(insertions.length - 1);

    // We take a page size of 2 since the 3rd would be off the end, starting at offset 1
    expect(resIns[0].contentId).toEqual(insertions[1].contentId);
    expect(resIns[1].contentId).toEqual(insertions[2].contentId);

    // Positions start at offset when Unpaged.
    expect(resIns[0].position).toEqual(1);
    expect(resIns[1].position).toEqual(2);
  });

  describe('pages a window when insertionStart != 0', () => {
    it('offset - insertionStart = 0', () => {
      const insertionStart = 5;
      // This is a different block of request insertions (starting at 5).
      insertions = [
        {
          contentId: '5',
        },
        {
          contentId: '6',
        },
        {
          contentId: '7',
        },
      ];
      // This should return [6, 7].
      const paging: Paging = {
        size: 2,
        offset: 5,
      };
      const resIns = pager.applyPaging(insertions, insertionStart, paging);
      expect(resIns.length).toEqual(insertions.length - 1);

      // We take a page size of 2 starting at the beginning since prepaged.
      expect(resIns[0].contentId).toEqual(insertions[0].contentId);
      expect(resIns[1].contentId).toEqual(insertions[1].contentId);

      // Positions start at offset.
      expect(resIns[0].position).toEqual(5);
      expect(resIns[1].position).toEqual(6);
    });

    it('offset - insertionStart = 1', () => {
      const insertionStart = 5;
      // This is a different block of request insertions (starting at 5).
      insertions = [
        {
          contentId: '5',
        },
        {
          contentId: '6',
        },
        {
          contentId: '7',
        },
      ];
      // This should return [6, 7].
      const paging: Paging = {
        size: 2,
        offset: 6,
      };
      const resIns = pager.applyPaging(insertions, insertionStart, paging);
      expect(resIns.length).toEqual(insertions.length - 1);

      // We take a page size of 2 starting at the beginning since prepaged.
      expect(resIns[0].contentId).toEqual(insertions[1].contentId);
      expect(resIns[1].contentId).toEqual(insertions[2].contentId);

      // Positions start at offset.
      expect(resIns[0].position).toEqual(6);
      expect(resIns[1].position).toEqual(7);
    });

    it('offset outside of size', () => {
      const insertionStart = 5;
      // This is a different block of request insertions (starting at 5).
      insertions = [
        {
          contentId: '5',
        },
        {
          contentId: '6',
        },
        {
          contentId: '7',
        },
      ];
      // This should return [6, 7].
      const paging: Paging = {
        size: 2,
        offset: 8,
      };
      const resIns = pager.applyPaging(insertions, insertionStart, paging);
      expect(resIns.length).toEqual(0);
    });
  });

  it('returns everything with no paging provided', () => {
    const resIns = pager.applyPaging(insertions, 0);
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

    const resIns = pager.applyPaging(insertions, 0);
    expect(resIns.length).toEqual(insertions.length);

    // Should leave positions alone that were already set, presumably these came from Delivery API.
    expect(resIns[0].position).toEqual(100);
    expect(resIns[1].position).toEqual(101);
    expect(resIns[2].position).toEqual(102);
  });

  it('handles empty input for insertionStart=0', () => {
    const resIns = pager.applyPaging([], 0);
    expect(resIns.length).toEqual(0);
  });

  it('handles empty input for insertionStart != 0', () => {
    const paging: Paging = {
      size: 0,
      offset: 1,
    };
    const resIns = pager.applyPaging([], 1, paging);
    expect(resIns.length).toEqual(0);
  });

  it('handles empty input when paging provided', () => {
    const paging: Paging = {
      size: 1,
      offset: 1,
    };
    const resIns = pager.applyPaging([], 0, paging);
    expect(resIns.length).toEqual(0);
  });

  it('returns everything with huge page size', () => {
    const paging: Paging = {
      size: 100,
      offset: 0,
    };
    const resIns = pager.applyPaging(insertions, 0, paging);
    expect(resIns.length).toEqual(insertions.length);
  });

  it('returns everything with invalid page size', () => {
    const paging: Paging = {
      size: -1,
      offset: 0,
    };
    const resIns = pager.applyPaging(insertions, 0, paging);
    expect(resIns.length).toEqual(insertions.length);
  });

  it('handles invalid offset by starting at 0', () => {
    const paging: Paging = {
      size: 100,
      offset: -1,
    };
    const resIns = pager.applyPaging(insertions, 0, paging);
    expect(resIns.length).toEqual(insertions.length);
    expect(resIns[0].position).toEqual(0);
    expect(resIns[1].position).toEqual(1);
    expect(resIns[2].position).toEqual(2);
  });
});
