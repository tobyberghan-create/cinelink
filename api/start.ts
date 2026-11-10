import { handleStart } from './_lib/handlers.js';

export function GET(request: Request): Promise<Response> {
  return handleStart(request);
}
