import { handleStart } from './_lib/handlers';

export function GET(request: Request): Promise<Response> {
  return handleStart(request);
}
