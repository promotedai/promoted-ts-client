import { Insertion } from './types/delivery';

interface HasInsertionId {
  insertionId: string | undefined | null;
}

/**
 * Returns a list of Content by mapping responseInsertions.content using
 * contentLookup.  Skips content not found in contentLookup.
 */
export const toContents = <T extends HasInsertionId>(
  responseInsertions: Insertion[],
  contentLookup: Record<string, T>
): T[] => {
  return responseInsertions.reduce((results: T[], insertion: Insertion): T[] => {
    const { contentId } = insertion;
    if (!contentId) {
      console.warn('Encounter missing Insertion.contentId');
    } else {
      const content = contentLookup[contentId];
      // Do not include results if the contentId details cannot be found.
      if (content) {
        results.push({
          ...content,
          insertionId: insertion.insertionId,
        });
      }
    }
    return results;
  }, []);
};

/**
 * Returns a list of Content by mapping responseInsertions.content using
 * contentLookup.  Skips missing contentIds and logs a warning.
 */
export const toContentsWithoutInsertionId = <T>(
  responseInsertions: Insertion[],
  contentLookup: Record<string, any>
): T[] => {
  return responseInsertions.reduce((results: T[], insertion: Insertion): T[] => {
    const { contentId } = insertion;
    if (!contentId) {
      console.warn('Encounter missing Insertion.contentId');
    } else {
      const content = contentLookup[contentId];
      // Do not include results if the contentId details cannot be found.
      if (content) {
        results.push(content);
      }
    }
    return results;
  }, []);
};
