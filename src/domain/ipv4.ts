export type BaseNetwork = {
  ip: string;
  prefix: number;
};

export type SubnetInfo = {
  network: string;
  networkInt: number;
  broadcast: string;
  broadcastInt: number;
  mask: string;
  wildcard: string;
  first: string;
  last: string;
  usable: number;
  total: number;
  prefix: number;
};

export function ipToInt(ip: string): number {
  const p = ip.split('.').map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export function intToIp(int: number): string {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
}

export function maskFromPrefix(prefix: number): number {
  return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
}

export function parseCIDR(str: string): { ip: string; prefix: number } | null {
  const m = str.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!m) return null;
  const octs = m.slice(1, 5).map(Number);
  const prefix = Number(m[5]);
  if (octs.some(o => o < 0 || o > 255) || prefix < 0 || prefix > 32) return null;
  return { ip: octs.join('.'), prefix };
}

// ── Address classification ───────────────────────────────────────────────

export type AddressClass = {
  label: string;
  rfc: string;
  variant: 'private' | 'special' | 'public' | 'multicast' | 'reserved';
};

const SPECIAL_RANGES: Array<{ base: number; mask: number } & AddressClass> = [
  // Private use (RFC 1918)
  { base: 0x0A000000, mask: 0xFF000000, label: 'Private',       rfc: 'RFC 1918',  variant: 'private'   }, // 10/8
  { base: 0xAC100000, mask: 0xFFF00000, label: 'Private',       rfc: 'RFC 1918',  variant: 'private'   }, // 172.16/12
  { base: 0xC0A80000, mask: 0xFFFF0000, label: 'Private',       rfc: 'RFC 1918',  variant: 'private'   }, // 192.168/16
  // Loopback
  { base: 0x7F000000, mask: 0xFF000000, label: 'Loopback',      rfc: 'RFC 5735',  variant: 'special'   }, // 127/8
  // Link-local
  { base: 0xA9FE0000, mask: 0xFFFF0000, label: 'Link-local',    rfc: 'RFC 3927',  variant: 'special'   }, // 169.254/16
  // Multicast
  { base: 0xE0000000, mask: 0xF0000000, label: 'Multicast',     rfc: 'RFC 5771',  variant: 'multicast' }, // 224/4
  // Carrier-grade NAT
  { base: 0x64400000, mask: 0xFFC00000, label: 'CGN',           rfc: 'RFC 6598',  variant: 'special'   }, // 100.64/10
  // Documentation / TEST-NET
  { base: 0xC0000200, mask: 0xFFFFFF00, label: 'Documentation', rfc: 'RFC 5737',  variant: 'special'   }, // 192.0.2/24
  { base: 0xC6336400, mask: 0xFFFFFF00, label: 'Documentation', rfc: 'RFC 5737',  variant: 'special'   }, // 198.51.100/24
  { base: 0xCB007100, mask: 0xFFFFFF00, label: 'Documentation', rfc: 'RFC 5737',  variant: 'special'   }, // 203.0.113/24
  // Benchmarking
  { base: 0xC6120000, mask: 0xFFFE0000, label: 'Benchmarking',  rfc: 'RFC 2544',  variant: 'special'   }, // 198.18/15
  // IETF Protocol
  { base: 0xC0000000, mask: 0xFFFFFF00, label: 'IETF Protocol', rfc: 'RFC 6890',  variant: 'reserved'  }, // 192.0.0/24
  // Broadcast
  { base: 0xFFFFFFFF, mask: 0xFFFFFFFF, label: 'Broadcast',     rfc: 'RFC 919',   variant: 'reserved'  }, // 255.255.255.255
  // This network
  { base: 0x00000000, mask: 0xFF000000, label: 'This Network',  rfc: 'RFC 1122',  variant: 'reserved'  }, // 0/8
  // Reserved (Class E)
  { base: 0xF0000000, mask: 0xF0000000, label: 'Reserved',      rfc: 'RFC 1112',  variant: 'reserved'  }, // 240/4
];

export function classifyAddress(ip: string): AddressClass {
  const n = ipToInt(ip);
  for (const r of SPECIAL_RANGES) {
    if ((n & r.mask) >>> 0 === r.base >>> 0) {
      return { label: r.label, rfc: r.rfc, variant: r.variant };
    }
  }
  return { label: 'Public / Routable', rfc: 'IANA', variant: 'public' };
}

export function subnetInfo(ip: string, prefix: number): SubnetInfo {
  const ipInt = ipToInt(ip);
  const mask = maskFromPrefix(prefix);
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = Math.pow(2, 32 - prefix);
  let first, last, usable;
  if (prefix >= 31) {
	first = network;
	last = broadcast;
	usable = prefix === 32 ? 1 : 2;
  } else {
	first = network + 1;
	last = broadcast - 1;
	usable = total - 2;
  }
  return {
	network: intToIp(network),
	networkInt: network,
	broadcast: intToIp(broadcast),
	broadcastInt: broadcast,
	mask: intToIp(mask),
	wildcard: intToIp(~mask >>> 0),
	first: intToIp(first),
	last: intToIp(last),
	usable,
	total,
	prefix,
  };
}
