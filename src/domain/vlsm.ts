import { SubnetInfo, subnetInfo, intToIp, maskFromPrefix, ipToInt } from './ipv4';

export type AllocationRequest = {
  id: string;
  name: string;
  hostsNeeded: number;
  order: number;
};

export type Allocation = {
  id: string;
  name: string;
  requestedHosts: number;
  derivedPrefix: number;
  mask?: string;
  wildcard?: string;
  network: string;
  broadcast: string;
  first: string;
  last: string;
  usable: number;
  status: 'allocated' | 'conflict' | 'overflow';
};

// ── Unallocated remainder type ────────────────────────────────────────────────
// Represents a single contiguous unallocated range.
// `coverPrefix` is the smallest CIDR prefix whose containing block covers the
// entire range, even when the range itself is not CIDR-aligned.
export type UnallocatedRange = {
  firstAddr: string;
  firstInt: number;
  lastAddr: string;
  lastInt: number;
  total: number;   // exact address count
  /** Smallest prefix whose containing CIDR block covers the entire range. */
  coverPrefix: number;
};

/**
 * Returns the smallest CIDR prefix that can cover `total` IPv4 addresses.
 *
 * `total` is treated as an exact address count, not usable hosts. The result is
 * conservative for non-power-of-two totals and exact for power-of-two totals.
 */
export function coverPrefixForAddressCount(total: number): number {
  if (total <= 1) return 32;
  const bitsNeeded = Math.ceil(Math.log2(total));
  return Math.max(0, 32 - bitsNeeded);
}

/** Returns the smallest CIDR prefix whose containing block covers `[startInt, endInt]`. */
export function coverPrefixForRange(startInt: number, endInt: number): number {
  if (endInt <= startInt) return 32;
  return Math.clz32((startInt ^ endInt) >>> 0);
}

/**
 * Allocates VLSM requests using a largest-first packing strategy.
 *
 * Request list order does not affect the packed result because requests are
 * sorted by `hostsNeeded` descending before placement.
 */
export function allocateVLSM(
  baseNetwork: { ip: string; prefix: number },
  requests: AllocationRequest[],
): { allocations: Allocation[]; unallocated: UnallocatedRange | null } {
  const base = subnetInfo(baseNetwork.ip, baseNetwork.prefix);

  // Sort by hosts needed descending for first-fit
  const sortedRequests = [...requests].sort((a, b) => b.hostsNeeded - a.hostsNeeded);

  const allocations: Allocation[] = [];
  let currentInt = base.networkInt;
  const baseEnd = base.broadcastInt;

  for (const req of sortedRequests) {
    // Skip requests with no hosts needed — they haven't been filled in yet
    if (req.hostsNeeded <= 0) continue;

    // Calculate minimal prefix
    let prefix: number;
    let usable: number;

    if (req.hostsNeeded === 1) {
      prefix = 32;
      usable = 1;
    } else if (req.hostsNeeded === 2) {
      prefix = 31;
      usable = 2;
    } else {
      prefix = Math.floor(32 - Math.log2(req.hostsNeeded + 2));
      usable = Math.pow(2, 32 - prefix) - 2;
    }

    const size = Math.pow(2, 32 - prefix);

    // Check for overflow (before alignment)
    if (currentInt + size - 1 > baseEnd) {
      allocations.push({
        id: req.id, name: req.name,
        requestedHosts: req.hostsNeeded,
        derivedPrefix: prefix,
        network: 'N/A', broadcast: 'N/A',
        first: 'N/A', last: 'N/A',
        usable: 0, status: 'overflow',
      });
      continue;
    }

    // Align currentInt to the prefix boundary
    while (currentInt % size !== 0) {
      currentInt++;
      if (currentInt > baseEnd) break;
    }

    // Check for overflow after alignment
    if (currentInt + size - 1 > baseEnd) {
      allocations.push({
        id: req.id, name: req.name,
        requestedHosts: req.hostsNeeded,
        derivedPrefix: prefix,
        network: 'N/A', broadcast: 'N/A',
        first: 'N/A', last: 'N/A',
        usable: 0, status: 'overflow',
      });
      continue;
    }

    const info = subnetInfo(intToIp(currentInt), prefix);
    allocations.push({
      id: req.id, name: req.name,
      requestedHosts: req.hostsNeeded,
      derivedPrefix: prefix,
      mask: info.mask,
      wildcard: info.wildcard,
      network: info.network,
      broadcast: info.broadcast,
      first: info.first,
      last: info.last,
      usable: info.usable,
      status: 'allocated',
    });

    currentInt += size;
  }

  // ── Single unallocated remainder ─────────────────────────────────────────
  // Rather than decomposing into multiple CIDR-aligned blocks we represent the
  // entire remaining range as one logical "unallocated" span.
  let unallocated: UnallocatedRange | null = null;
  if (currentInt <= baseEnd) {
    const total = baseEnd - currentInt + 1;
    const coverPrefix = coverPrefixForRange(currentInt, baseEnd);
    unallocated = {
      firstAddr: intToIp(currentInt),
      firstInt: currentInt,
      lastAddr: intToIp(baseEnd),
      lastInt: baseEnd,
      total,
      coverPrefix,
    };
  }

  return { allocations, unallocated };
}
