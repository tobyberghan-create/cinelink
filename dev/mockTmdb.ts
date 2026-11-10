/**
 * Dev-only fake TMDB (`TMDB_MOCK=1 npm run dev`): a handful of films with real
 * TMDB IDs so the whole UI can be exercised offline. Posters/headshots will 404
 * unless the real CDN is reachable, which is fine for layout checks.
 */
import type { Fetcher } from '../api/_lib/tmdb';

type P = { id: number; name: string; character?: string; order?: number; popularity?: number; job?: string };
const cast = (id: number, name: string, character: string, order: number, popularity = 20): P => ({ id, name, character, order, popularity });
const crew = (id: number, name: string, job: string): P => ({ id, name, job });

const films: Record<number, { title: string; release_date: string; cast: P[]; crew: P[] }> = {
  603: {
    title: 'The Matrix',
    release_date: '1999-03-31',
    cast: [cast(6384, 'Keanu Reeves', 'Neo', 0, 60), cast(2975, 'Laurence Fishburne', 'Morpheus', 1, 30), cast(530, 'Carrie-Anne Moss', 'Trinity', 2, 25), cast(1331, 'Hugo Weaving', 'Agent Smith', 3, 28)],
    crew: [crew(9339, 'Lilly Wachowski', 'Director'), crew(9340, 'Lana Wachowski', 'Director'), crew(9339, 'Lilly Wachowski', 'Screenplay'), crew(1217, 'Bill Pope', 'Director of Photography'), crew(2452, 'Don Davis', 'Original Music Composer')],
  },
  245891: {
    title: 'John Wick',
    release_date: '2014-10-22',
    cast: [cast(6384, 'Keanu Reeves', 'John Wick', 0, 60), cast(2524, 'Michael Nyqvist', 'Viggo Tarasov', 1, 10), cast(1114, 'Willem Dafoe', 'Marcus', 2, 35)],
    crew: [crew(40644, 'Chad Stahelski', 'Director'), crew(1252035, 'Derek Kolstad', 'Writer')],
  },
  10196: {
    title: 'The Last Airbender',
    release_date: '2010-06-30',
    cast: [cast(2000, 'Noah Ringer', 'Aang', 0, 5), cast(5000, 'Dev Patel', 'Zuko', 1, 20)],
    crew: [crew(11614, 'M. Night Shyamalan', 'Director'), crew(11614, 'M. Night Shyamalan', 'Writer')],
  },
  2501: {
    title: 'The Bourne Identity',
    release_date: '2002-06-14',
    cast: [cast(1892, 'Matt Damon', 'Jason Bourne', 0, 50), cast(3303, 'Franka Potente', 'Marie', 1, 12), cast(1121, 'Chris Cooper', 'Conklin', 2, 15)],
    crew: [crew(1119, 'Doug Liman', 'Director'), crew(8100, 'Tony Gilroy', 'Screenplay')],
  },
  2503: {
    title: 'The Bourne Ultimatum',
    release_date: '2007-08-03',
    cast: [cast(1892, 'Matt Damon', 'Jason Bourne', 0, 50), cast(3061, 'Julia Stiles', 'Nicky Parsons', 1, 14), cast(1121, 'Chris Cooper', 'Conklin', 9, 15)],
    crew: [crew(3192, 'Paul Greengrass', 'Director'), crew(8100, 'Tony Gilroy', 'Screenplay')],
  },
  694: {
    title: 'The Shining',
    release_date: '1980-05-23',
    cast: [cast(514, 'Jack Nicholson', 'Jack Torrance', 0, 40), cast(4070, 'Shelley Duvall', 'Wendy Torrance', 1, 12), cast(9999, 'Stanley Kubrick', 'Himself (archive footage)', 20, 30)],
    crew: [crew(240, 'Stanley Kubrick', 'Director'), crew(240, 'Stanley Kubrick', 'Screenplay'), crew(3000, 'Stephen King', 'Novel')],
  },
  11: {
    title: 'Star Wars',
    release_date: '1977-05-25',
    cast: [cast(2, 'Mark Hamill', 'Luke Skywalker', 0, 30), cast(3, 'Harrison Ford', 'Han Solo', 1, 45), cast(4, 'Carrie Fisher', 'Princess Leia', 2, 25)],
    crew: [crew(1, 'George Lucas', 'Director'), crew(1, 'George Lucas', 'Writer'), crew(491, 'John Williams', 'Original Music Composer')],
  },
  999999: { title: 'The Matrix: Unreleased Sequel', release_date: '2099-01-01', cast: [cast(6384, 'Keanu Reeves', 'Neo', 0, 60)], crew: [] },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const mockFetcher: Fetcher = async (input) => {
  const url = new URL(String(input));
  await new Promise((r) => setTimeout(r, 150)); // a little latency so the spinner/pause logic is visible
  if (url.pathname === '/3/search/movie') {
    const q = (url.searchParams.get('query') ?? '').toLowerCase();
    const results = Object.entries(films)
      .filter(([, f]) => f.title.toLowerCase().includes(q))
      .map(([id, f]) => ({ id: Number(id), title: f.title, release_date: f.release_date, poster_path: null }));
    return json({ results });
  }
  if (url.pathname === '/3/discover/movie') {
    const page = Number(url.searchParams.get('page'));
    return json({ results: page === 1 ? [603, 2501, 694, 11].map((id) => ({ id })) : [] });
  }
  const m = url.pathname.match(/\/3\/movie\/(\d+)/);
  if (m) {
    const f = films[Number(m[1])];
    if (!f) return json({ status_message: 'not found' }, 404);
    return json({ id: Number(m[1]), title: f.title, release_date: f.release_date, poster_path: null, credits: { cast: f.cast, crew: f.crew } });
  }
  return json({}, 500);
};
