import { describe, expect, it } from 'vitest';
import { isPublicAddress, safeTarget } from './network.ts';

describe('public network boundary', () => {
  it('accepts public IPv4 without treating all IPv4 as mapped-address exclusions', () => {
    for (const address of ['182.242.214.100', '119.147.3.178', '183.60.15.56', '8.8.8.8']) expect(isPublicAddress(address)).toBe(true);
  });
  it('rejects private, loopback, metadata, test and mapped addresses', () => {
    for (const address of ['127.0.0.1', '10.0.0.1', '172.16.2.1', '192.168.1.2', '169.254.169.254',
      '100.64.0.1', '198.18.0.1', '192.0.2.1', '203.0.113.1', '224.1.1.1', '::1', '::ffff:127.0.0.1',
      '::ffff:8.8.8.8', 'fc00::1', 'fe80::1', '2001:db8::1']) expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });
  it('rejects userinfo, alternate ports and unknown outbound hosts', () => {
    const allowed = (host: string) => host === 'music.163.com';
    expect(() => safeTarget('https://user:password@music.163.com/', allowed)).toThrow();
    expect(() => safeTarget('https://music.163.com:8080/', allowed)).toThrow();
    expect(() => safeTarget('https://127.0.0.1/', allowed)).toThrow();
    expect(safeTarget('https://music.163.com/api/v6/playlist/detail', allowed).hostname).toBe('music.163.com');
  });
});
