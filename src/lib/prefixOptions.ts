export const NETWORK_PREFIX_BUTTONS = [8, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

/**
 * Prevents equal-split mode from generating an impractically large number of blocks
 * in the UI. The app currently materializes every block before paginating.
 */
export const MAX_EQUAL_SPLIT_BLOCKS = 4096;

export function getAvailableEqualSplitPrefixes(basePrefix: number): number[] {
	const prefixes: number[] = [];
	for (let prefix = basePrefix + 1; prefix <= 32; prefix += 1) {
		const subnetCount = Math.pow(2, prefix - basePrefix);
		if (subnetCount <= MAX_EQUAL_SPLIT_BLOCKS) {
			prefixes.push(prefix);
		}
	}
	return prefixes;
}
