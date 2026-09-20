import { describe, it, expect } from 'vitest';
import { subnetInfo, parseCIDR, ipToInt } from './ipv4';
import { allocateVLSM, coverPrefixForAddressCount, coverPrefixForRange } from './vlsm';

describe('IPv4 Domain Logic', () => {
  it('correctly parses valid CIDR', () => {
    expect(parseCIDR('192.168.1.0/24')).toEqual({ ip: '192.168.1.0', prefix: 24 });
    expect(parseCIDR('10.0.0.0/8')).toEqual({ ip: '10.0.0.0', prefix: 8 });
  });

  it('returns null for invalid CIDR', () => {
    expect(parseCIDR('192.168.1.256/24')).toBeNull();
    expect(parseCIDR('not-an-ip/24')).toBeNull();
    expect(parseCIDR('192.168.1.0/33')).toBeNull();
  });

  it('computes subnet info correctly for /24', () => {
    const info = subnetInfo('192.168.1.0', 24);
    expect(info.network).toBe('192.168.1.0');
    expect(info.broadcast).toBe('192.168.1.255');
    expect(info.usable).toBe(254);
    expect(info.mask).toBe('255.255.255.0');
  });

  it('handles /31 point-to-point links', () => {
    const info = subnetInfo('192.168.1.0', 31);
    expect(info.usable).toBe(2);
  });

  it('handles /32 single hosts', () => {
    const info = subnetInfo('192.168.1.1', 32);
    expect(info.usable).toBe(1);
  });
});

describe('VLSM Allocation Logic', () => {
  it('allocates subnets in descending order of size', () => {
    const base = { ip: '10.0.0.0', prefix: 24 };
    const requests = [
      { id: '1', name: 'Small', hostsNeeded: 10, order: 0 },
      { id: '2', name: 'Large', hostsNeeded: 100, order: 1 },
    ];
    const { allocations } = allocateVLSM(base, requests);

    // Large should be first regardless of request order
    expect(allocations[0].name).toBe('Large');
    expect(allocations[0].derivedPrefix).toBe(25); // 128 addresses
    expect(allocations[1].name).toBe('Small');
    expect(allocations[1].derivedPrefix).toBe(28); // 16 addresses
  });

  it('marks overflow when base block is exhausted', () => {
    const base = { ip: '192.168.1.0', prefix: 30 }; // Only 4 addresses
    const requests = [
      { id: '1', name: 'TooBig', hostsNeeded: 100, order: 0 },
    ];
    const { allocations } = allocateVLSM(base, requests);
    expect(allocations[0].status).toBe('overflow');
  });

  it('computes the smallest covering prefix for exact remainder sizes', () => {
    expect(coverPrefixForAddressCount(1)).toBe(32);
    expect(coverPrefixForAddressCount(2)).toBe(31);
    expect(coverPrefixForAddressCount(4)).toBe(30);
    expect(coverPrefixForAddressCount(8)).toBe(29);
    expect(coverPrefixForAddressCount(16)).toBe(28);
  });

  it('computes the smallest covering prefix for an arbitrary address range', () => {
    expect(coverPrefixForRange(ipToInt('10.0.0.64'), ipToInt('10.0.0.191'))).toBe(24);
    expect(coverPrefixForRange(ipToInt('10.0.0.128'), ipToInt('10.0.0.255'))).toBe(25);
  });

  it('reports the tightest covering prefix for the unallocated remainder', () => {
    const base = { ip: '10.0.0.0', prefix: 24 };
    const requests = [
      { id: '1', name: 'Large', hostsNeeded: 100, order: 0 },
    ];
    const { unallocated } = allocateVLSM(base, requests);
    expect(unallocated).not.toBeNull();
    expect(unallocated?.total).toBe(128);
    expect(unallocated?.coverPrefix).toBe(25);
    expect(unallocated?.firstAddr).toBe('10.0.0.128');
    expect(unallocated?.lastAddr).toBe('10.0.0.255');
  });
});
