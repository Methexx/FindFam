import { describe, it, expect } from 'vitest';
import { isExpired } from '../middleware';

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.fakesignature`;
}

describe('isExpired', () => {
  it('returns true for a token whose exp is in the past', () => {
    expect(isExpired(fakeJwt({ sub: 'admin1', exp: 1000000000 }))).toBe(true);
  });

  it('returns false for a token whose exp is in the future', () => {
    expect(isExpired(fakeJwt({ sub: 'admin1', exp: 9999999999 }))).toBe(false);
  });

  it('returns true when exp is missing from the payload', () => {
    expect(isExpired(fakeJwt({ sub: 'admin1' }))).toBe(true);
  });

  it('returns true for a malformed token with no payload segment', () => {
    expect(isExpired('not-a-jwt')).toBe(true);
  });

  it('returns true for a payload segment that is not valid JSON', () => {
    const badPayload = Buffer.from('not json').toString('base64url');
    expect(isExpired(`header.${badPayload}.sig`)).toBe(true);
  });
});
