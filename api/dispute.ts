import { handleDispute } from './_lib/dispute.js';

export function POST(request: Request): Promise<Response> {
  return handleDispute(request);
}
