import { handleSearch } from './_lib/handlers';

export function GET(request: Request): Promise<Response> {
  return handleSearch(request);
}
