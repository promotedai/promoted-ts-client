import { Insertion, Paging } from './types/delivery';

export const getOffset = (paging: Paging | undefined) => {
  return Math.max(0, paging?.offset ?? 0);
};

const getSize = (paging: Paging | undefined, requestInsertions: Insertion[]) => {
  const size = paging?.size ?? -1;
  if (size <= 0) {
    return requestInsertions.length;
  }
  return size;
};

export class Pager {
  /**
   * Sets the position field on each assertion based on paging parameters and takes
   * a page of request insertions (if necessary).
   * @param requestInsertions the request insertions
   * @param requestInsertionStart in the global set of all request insertions, how
   *                              far down is the subset of requestInsertions
   * @param paging paging info, may be nil
   * @returns the modified page of insertions
   */
  applyPaging = (requestInsertions: Insertion[], requestInsertionStart: number, paging?: Paging): Insertion[] => {
    let offset = getOffset(paging);
    // validator.ts makes sure that index is positive.
    let index = offset - requestInsertionStart;
    const size = getSize(paging, requestInsertions);

    const finalInsertionSize = Math.min(size, requestInsertions.length - index);
    if (finalInsertionSize <= 0) {
      return [];
    }
    const insertionPage: Insertion[] = new Array(finalInsertionSize);
    for (let i = 0; i < finalInsertionSize; i++) {
      const requestInsertion = requestInsertions[index];
      // Convert the Request Insertion to a Response Insertion.
      // InsertionId is filled in by the caller.
      insertionPage[i] = {
        contentId: requestInsertion.contentId,
        position: requestInsertion.position ?? offset,
      };
      index++;
      offset++;
    }
    return insertionPage;
  };
}
