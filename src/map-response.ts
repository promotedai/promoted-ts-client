import { Insertion } from './types/delivery';

interface HasInsertionId {
  insertionId?: string;
}

/**
 * Returns a list of Content by mapping responseInsertions.content using
 * contentLookup.  Skips missing contentIds and logs a warning.
 */
export const toContents = <T extends HasInsertionId>(
  responseInsertions: Insertion[],
  contentLookup: Record<string, T>
): T[] => {
  const results: T[] = [];
  responseInsertions.forEach((insertion) => {
    const { contentId } = insertion;
    if (!contentId) {
      console.warn('Encounter missing Insertion.contentId');
      return;
    }
    const content = contentLookup[contentId];
    // Do not include results if the contentId details cannot be found.
    if (content) {
      results.push({
        ...content,
        insertionId: insertion.insertionId,
      });
    } else {
      console.warn(`Dropping content ${insertion.contentId} from Promoted ranking.`);
    }
  });
  return results;
};

/**
 * Returns a list of Content by mapping responseInsertions.content using
 * contentLookup.  Skips missing contentIds and logs a warning.
 */
export const toContentsWithoutInsertionId = <T>(
  responseInsertions: Insertion[],
  contentLookup: Record<string, any>
): T[] => {
  const results: T[] = [];
  responseInsertions.forEach((insertion) => {
    const { contentId } = insertion;
    if (!contentId) {
      console.warn('Encounter missing Insertion.contentId');
      return;
    }
    const content = contentLookup[contentId];
    // Do not include results if the contentId details cannot be found.
    if (content) {
      results.push(content);
    } else {
      console.warn(`Dropping content ${insertion.contentId} from Promoted ranking.`);
    }
  });
  return results;
};
