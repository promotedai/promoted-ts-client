import { InsertionPageType } from './insertion-page-type';
import { Insertion, Paging } from './types/delivery';

export class Pager {
  /**
   * Sets the correct position field on each assertion based on paging parameters and takes
   * a page of full insertions (if necessary).
   * @param insertions the full set of insertions
   * @param assignPosition whether or not to assign a position to the insertions, which deliver requests do and log requests may not.
   * @param paging paging info, may be nil
   * @param insertionPageType the type of paging the client wants, defaults to "unpaged"
   * @returns the modified page of insertions
   */
  applyPaging = (
    insertions: Insertion[],
    assignPosition: boolean,
    paging?: Paging,
    insertionPageType?: InsertionPageType
  ): Insertion[] => {
    const insertionPage: Insertion[] = [];
    let start = paging?.offset ?? 0;
    if (insertionPageType === InsertionPageType.PrePaged) {
      // When insertions are pre-paged, we ignore any provided offset.
      start = 0;
    }

    let size = paging?.size ?? -1;
    if (size <= 0) {
      size = insertions.length;
    }

    for (let index = start; index < insertions.length; index++) {
      if (insertionPage.length >= size) {
        break;
      }

      const insertion = insertions[index];
      if (assignPosition) {
        insertion.position = start;
      }
      insertionPage.push(insertion);
      start++;
    }

    return insertionPage;
  };
}
