import { handleMovie } from '../_lib/handlers';

export function GET(request: Request): Promise<Response> {
  // Vercel passes dynamic segments as query params for Web-signature functions.
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? url.pathname.split('/').pop();
  return handleMovie(id);
}
