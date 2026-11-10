/**
 * POST /api/dispute — logs a rejected answer's IDs for review (Build Plan:
 * "A Dispute button on any rejected answer logs the two IDs for review. In v1
 * the life is still lost"). Writes one structured line to the function log;
 * the client also sends the same data as an anonymous `dispute` analytics
 * event, which is the durable copy.
 */
export interface Dispute {
  mode: 'actor' | 'film';
  reason: string;
  filmIds: number[];
  personId?: number;
}

export function parseDispute(body: unknown): Dispute | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.mode !== 'actor' && b.mode !== 'film') return null;
  if (typeof b.reason !== 'string' || b.reason.length > 40) return null;
  if (!Array.isArray(b.filmIds) || b.filmIds.length === 0 || b.filmIds.length > 2) return null;
  if (!b.filmIds.every((n) => Number.isInteger(n) && (n as number) > 0)) return null;
  const personId = b.personId === undefined || b.personId === null || b.personId === '' ? undefined : Number(b.personId);
  if (personId !== undefined && !(Number.isInteger(personId) && personId > 0)) return null;
  return { mode: b.mode, reason: b.reason, filmIds: b.filmIds as number[], personId };
}

export async function handleDispute(request: Request, log: (line: string) => void = console.log): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const d = parseDispute(body);
  if (!d) return new Response(JSON.stringify({ error: 'bad_dispute' }), { status: 400, headers: { 'content-type': 'application/json' } });
  log(`DISPUTE ${JSON.stringify({ at: new Date().toISOString(), ...d })}`);
  return new Response(null, { status: 204 });
}
