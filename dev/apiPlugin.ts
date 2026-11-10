/**
 * Vite dev plugin: serves /api/* locally using the same handlers Vercel runs,
 * so `npm run dev` works without `vercel dev`. Reads TMDB_API_KEY from .env.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { handleMovie, handleSearch, handleStart, type HandlerDeps } from '../api/_lib/handlers';
import { mockFetcher } from './mockTmdb';

async function toResponse(req: IncomingMessage, deps: HandlerDeps): Promise<Response | null> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const request = new Request(url, { method: req.method ?? 'GET' });
  if (url.pathname === '/api/search') return handleSearch(request, deps);
  if (url.pathname === '/api/start') return handleStart(request, deps);
  const m = url.pathname.match(/^\/api\/movie\/(\d+)$/);
  if (m) return handleMovie(m[1], deps);
  return null;
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(await response.text());
}

export function apiDevPlugin(): Plugin {
  return {
    name: 'cinelink-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      if (env.TMDB_API_KEY && !process.env.TMDB_API_KEY) process.env.TMDB_API_KEY = env.TMDB_API_KEY;
      const mock = (process.env.TMDB_MOCK ?? env.TMDB_MOCK) === '1';
      if (mock) {
        process.env.TMDB_API_KEY ||= 'mock';
        server.config.logger.info('[cinelink] TMDB_MOCK=1: serving fake film data');
      }
      const deps: HandlerDeps = mock ? { fetcher: mockFetcher } : {};
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const response = await toResponse(req, deps);
        if (!response) {
          res.statusCode = 404;
          res.end('{"error":"not_found"}');
          return;
        }
        await send(res, response);
      });
    },
  };
}
