import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

// Replace this with the URL of the GitHub Release you created in Phase 2
// NOTE: The hash map below is tightly coupled to the binaries hosted at this URL.
// If you update the URL or rebuild the binaries, you MUST regenerate and update the hashes below.
const REPO_URL = "https://github.com/Cuates/rust/releases/download/v1.0.0-binaries";
const TARGET_DIR = path.resolve(process.cwd(), 'backend/sidecars');

// Map of filename to expected SHA-256 hash. 
// Replace null with actual hashes for production security.
const sidecars = {
    "ffmpeg-aarch64-apple-darwin": "9a08d61f9328e8164ba560ee7a79958e357307fcfeea6fe626b7d66cdc287028",
    "ffmpeg-x86_64-apple-darwin": "3a0ea97adddecfbf87b865da3bcbb321edfce4bab18a98ae1ba4ba9f0bd1f93a",
    "ffmpeg-x86_64-pc-windows-msvc.exe": "228d7a8556258de907fdb55f36850078ebc7680b84ec30d84ea02e99bec1d1eb",
    "ffmpeg-x86_64-unknown-linux-gnu": "e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99",
    "ffprobe-aarch64-apple-darwin": "aab17ac7379c1178aaf400c3ef36cdb67db0b75b1a23eeef2cb9f658be8844e6",
    "ffprobe-x86_64-apple-darwin": "a976306bcb8c9c50b2ac4e91f5aac4e45395e1f9063c46aecf1e1213e41c631b",
    "ffprobe-x86_64-pc-windows-msvc.exe": "0fde260f5abd35c9cafd96f594cc76365a780c1b73a90e35b6a3409ea1db1bf0",
    "ffprobe-x86_64-unknown-linux-gnu": "4f231a1960d83e403d08f7971e271707bec278a9ae18e21b8b5b03186668450d"
};

async function verifyChecksum(filePath, expectedHash) {
    if (!expectedHash) return true; // Skip if no hash provided

    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => {
            const actualHash = hash.digest('hex');
            resolve(actualHash === expectedHash);
        });
    });
}

async function downloadFile(filename, expectedHash) {
    const url = `${REPO_URL}/${filename}`;
    const destination = path.join(TARGET_DIR, filename);

    if (fs.existsSync(destination)) {
        console.log(`✅ Skipped ${filename} (Already exists)`);
        return;
    }

    console.log(`⬇️ Downloading ${filename}...`);
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

    const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
    await finished(Readable.fromWeb(response.body).pipe(fileStream));

    // Verify checksum
    const isValid = await verifyChecksum(destination, expectedHash);
    if (!isValid) {
        fs.unlinkSync(destination);
        throw new Error(`Checksum mismatch for ${filename}. File deleted for security.`);
    }

    // Ensure the binary is executable on macOS/Linux
    if (!filename.endsWith('.exe')) {
        fs.chmodSync(destination, 0o755);
    }

    console.log(`✅ Successfully downloaded and verified ${filename}`);
}

async function main() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    try {
        const downloads = Object.entries(sidecars).map(([filename, hash]) =>
            downloadFile(filename, hash)
        );
        await Promise.all(downloads);
        console.log("🎉 All sidecars are ready and verified!");
    } catch (error) {
        console.error("❌ Error downloading sidecars:", error);
        process.exit(1);
    }
}

main();