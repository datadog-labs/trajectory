/**
 * Extension inventory enumeration for the Pi trajectory plugin.
 *
 * Scans ~/.pi/agent/extensions/ for installed pi extensions and returns
 * their name and version. This is a best-effort filesystem scan — the pi SDK
 * does not expose a programmatic way to enumerate installed extensions.
 *
 * Symlinked extensions are resolved and still counted as extensions.
 * On any error, returns an empty array so session_start never fails.
 */

import { constants } from "node:fs";
import { lstat, open, opendir, realpath, type FileHandle } from "node:fs/promises";
import { join } from "node:path";

export interface ExtensionInfo {
	name: string;
	version: string;
}

const MAX_EXTENSIONS = 128;
const MAX_PACKAGE_BYTES = 64 * 1024;
const MAX_PACKAGE_READS = 128;

// The filesystem may return a short read before EOF. Preserve complete bounded
// metadata, while limiting both retained bytes and fragmented-read work.
export async function readExtensionPackageBytes(file: Pick<FileHandle, "read">): Promise<Buffer> {
	const buffer = Buffer.alloc(MAX_PACKAGE_BYTES + 1);
	let total = 0;
	let reads = 0;
	while (total < buffer.length) {
		if (++reads > MAX_PACKAGE_READS) throw new Error("extension metadata too fragmented");
		const { bytesRead } = await file.read(buffer, total, buffer.length - total, total);
		if (bytesRead === 0) break;
		total += bytesRead;
	}
	if (total > MAX_PACKAGE_BYTES) throw new Error("extension metadata grew too large");
	return buffer.subarray(0, total);
}

async function readPackage(path: string): Promise<{ name?: unknown; version?: unknown }> {
	// Windows has no O_NOFOLLOW. Bind the opened handle to a non-linked path
	// observation on both sides of open instead of treating a zero flag as protection.
	const before = await lstat(path, { bigint: true });
	if (!before.isFile() || before.size > BigInt(MAX_PACKAGE_BYTES)) throw new Error("extension metadata is not a bounded regular file");
	const file = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0));
	try {
		const info = await file.stat({ bigint: true });
		const after = await lstat(path, { bigint: true });
		if (!info.isFile() || !after.isFile() || info.size > BigInt(MAX_PACKAGE_BYTES) ||
			info.dev !== before.dev || info.ino !== before.ino ||
			info.dev !== after.dev || info.ino !== after.ino) throw new Error("extension metadata changed or is not a bounded regular file");
		return JSON.parse((await readExtensionPackageBytes(file)).toString("utf8"));
	} finally {
		await file.close();
	}
}

/**
 * List installed pi extensions from ~/.pi/agent/extensions/.
 * Returns an array of {name, version} objects. Best-effort: returns [] on error.
 */
export async function listInstalledExtensions(home = process.env.HOME || process.env.USERPROFILE || ""): Promise<ExtensionInfo[]> {
	try {
		if (!home) return [];

		const extensionsDir = join(home, ".pi", "agent", "extensions");
		const entries = await opendir(extensionsDir);

		const results: ExtensionInfo[] = [];
		const seen = new Set<string>();

		let inspected = 0;
		for await (const entry of entries) {
			if (++inspected > MAX_EXTENSIONS) break;

			// Skip hidden directories and node_modules
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

			// Only directories and symlinks are extensions
			if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

			try {
				// Resolve symlinks — symlinked extensions are still extensions
				const resolvedPath = await realpath(join(extensionsDir, entry.name));

				// Deduplicate by resolved path
				if (seen.has(resolvedPath)) continue;
				seen.add(resolvedPath);

				// Try to read package.json for name + version
				let name = entry.name;
				let version = "unknown";

				try {
					const pkg = await readPackage(join(resolvedPath, "package.json"));
					if (typeof pkg.name === "string" && pkg.name.length <= 256 && pkg.name.trim()) {
						name = pkg.name.trim();
					}
					if (typeof pkg.version === "string" && pkg.version.length <= 128 && pkg.version.trim()) {
						version = pkg.version.trim();
					}
				} catch {
					// No package.json or parse error — use directory name + "unknown"
				}

				results.push({ name, version });
			} catch {
				// realpath or other error — skip this entry
				continue;
			}
		}

		return results;
	} catch {
		// Any error (dir doesn't exist, permission denied, etc.) — return empty
		return [];
	}
}
