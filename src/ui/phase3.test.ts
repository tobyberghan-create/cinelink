import { describe, expect, it, vi } from 'vitest';
import { handleDispute, parseDispute } from '../../api/_lib/dispute';
import { buildShareText } from './share';

describe('Share text', () => {
  it('has mode, score and the game link', () => {
    const t = buildShareText('film', 12, 'https://cinelink.example');
    expect(t).toContain('Film Chain');
    expect(t).toContain('12 links');
    expect(t).toContain('https://cinelink.example');
    expect(buildShareText('actor', 1, 'x')).toContain('1 link ');
  });
});

describe('Dispute route', () => {
  it('accepts a valid dispute and logs both IDs', async () => {
    const log = vi.fn();
    const res = await handleDispute(
      new Request('http://x/api/dispute', { method: 'POST', body: JSON.stringify({ mode: 'film', reason: 'no_shared_people', filmIds: [100, 2] }) }),
      log,
    );
    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^DISPUTE \{.*"filmIds":\[100,2\]/);
  });
  it('rejects garbage, wrong methods and oversized payloads', async () => {
    expect(parseDispute({ mode: 'tv', reason: 'x', filmIds: [1] })).toBeNull();
    expect(parseDispute({ mode: 'actor', reason: 'x', filmIds: [] })).toBeNull();
    expect(parseDispute({ mode: 'actor', reason: 'x', filmIds: [1, 2, 3] })).toBeNull();
    expect(parseDispute({ mode: 'actor', reason: 'x', filmIds: ['a'] })).toBeNull();
    expect(parseDispute({ mode: 'actor', reason: 'not_in_cast', filmIds: [5], personId: 7 })).toEqual({ mode: 'actor', reason: 'not_in_cast', filmIds: [5], personId: 7 });
    expect((await handleDispute(new Request('http://x/api/dispute', { method: 'GET' }))).status).toBe(405);
    expect((await handleDispute(new Request('http://x/api/dispute', { method: 'POST', body: 'nope' }))).status).toBe(400);
  });
});
