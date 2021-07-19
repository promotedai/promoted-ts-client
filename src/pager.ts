import { InsertionPageType } from './insertion-page-type';
import { Insertion, Paging } from './types/delivery';

export class Pager {
  /**
   * Sets the position field on each assertion based on paging parameters and takes
   * a page of full insertions (if necessary).
   * @param insertions the full set of insertions
   * @param assignPosition whether or not to assign a position to the insertions, which deliver requests do and log requests may not.
   * @param paging paging info, may be nil
   * @param insertionPageType the type of paging the client wants
   * @returns the modified page of insertions
   */
  applyPaging = (
    insertions: Insertion[],
    assignPosition: boolean,
    insertionPageType?: InsertionPageType,
    paging?: Paging
  ): Insertion[] => {
    let offset = paging?.offset ?? 0;
    let index = offset;
    if (insertionPageType === InsertionPageType.PrePaged) {
      // When insertions are pre-paged, we ignore any provided offset.
      index = 0;
    }

    let size = paging?.size ?? -1;
    if (size <= 0) {
      size = insertions.length;
    }
    const insertionPage: Insertion[] = [];
    while (index < insertions.length && insertionPage.length < size) {
      const insertion = insertions[index];
      if (assignPosition) {
        insertion.position = offset;
      }
      insertionPage.push(insertion);
      index++;
      offset++;
    }
    return insertionPage;
  };
}
