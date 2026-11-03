import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../src/sync/supabase';

describe('normalizeUrl', () => {
  it('strips API paths and trailing slashes', () => {
    expect(normalizeUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co');
    expect(normalizeUrl(' https://abc.supabase.co/ ')).toBe('https://abc.supabase.co');
    expect(normalizeUrl('https://abc.supabase.co/auth/v1')).toBe('https://abc.supabase.co');
  });
});
