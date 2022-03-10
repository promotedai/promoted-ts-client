import { InsertionPageType } from './insertion-page-type';
import { Insertion, Paging } from './types/delivery';

export class Pager {
  /**
   * Sets the position field on each assertion based on paging parameters and takes
   * a page of request insertions (if necessary).
   * @param requestInsertions the request insertions
   * @param insertionPageType the type of paging the client wants
   * @param paging paging info, may be nil
   * @returns the modified page of insertions
   */
  applyPaging = (
    requestInsertions: Insertion[],
    insertionPageType: InsertionPageType,
    paging?: Paging
  ): Insertion[] => {
    let offset = paging?.offset ?? 0;
    if (offset <= 0) {
      offset = 0;
    }

    let index = offset;
    if (insertionPageType === InsertionPageType.PrePaged) {
      // When insertions are pre-paged, we don't use offset to
      // window into the provided assertions, although we do use it
      // when assigning positions.
      index = 0;
    }

    let size = paging?.size ?? -1;
    if (size <= 0) {
      size = requestInsertions.length;
    }

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
