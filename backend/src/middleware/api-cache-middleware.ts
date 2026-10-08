import type { RequestHandler } from "express";

/**
 * Private API responses must not be stored or served from a previous account.
 * Remove conditional request headers as this API has no client-side 304 body
 * contract; private callers always receive the JSON response to parse.
 */
export const disablePrivateCaching: RequestHandler = (request, response, next) => {
  delete request.headers["if-none-match"];
  delete request.headers["if-modified-since"];
  response.setHeader("Cache-Control", "private, no-store");
  next();
};
