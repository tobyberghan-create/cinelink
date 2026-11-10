import { handleDispute } from './_lib/dispute';

export function POST(request: Request): Promise<Response> {
  return handleDispute(request);
}
