/**
 * Simple function interface for making API calls.
 */
export interface ApiClient<Req, Res> {
  (request: Req): Promise<Res>;
}
