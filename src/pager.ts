import { InsertionPageType } from './insertion-page-type';
import { Insertion, Paging } from './types/delivery';

export class Pager {
  /**
   * Sets the position field on each assertion based on paging parameters and takes
   * a page of full insertions (if necessary).
   * @param insertions the full set of insertions
   * @param insertionPageType the type of paging the client wants
   * @param paging paging info, may be nil
   * @returns the modified page of insertions
   */
  applyPaging = (insertions: Insertion[], insertionPageType: InsertionPageType, paging?: Paging): Insertion[] => {
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
      size = insertions.length;
    }
    const insertionPage: Insertion[] = [];
    while (index < insertions.length && insertionPage.length < size) {
      const insertion = insertions[index];
      if (insertion.position === undefined) {
        insertion.position = offset;
      }
      insertionPage.push(insertion);
      index++;
      offset++;
    }
    return insertionPage;
  };
}
