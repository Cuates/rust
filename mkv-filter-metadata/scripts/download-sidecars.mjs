import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

// Replace this with the URL of the GitHub Release you created in Phase 2
const REPO_URL = "https://github.com/Cuates/rust/releases/download/v1.0.0-binaries";
const TARGET_DIR = path.resolve(process.cwd(), 'backend/sidecars');

// Map of filename to expected SHA-256 hash. 
// Replace null with actual hashes for production security.
const sidecars = {
    'ffmpeg-aarch64-apple-darwin': null,
    'ffmpeg-x86_64-apple-darwin': null,
    'ffmpeg-x86_64-pc-windows-msvc.exe': null,
    'ffmpeg-x86_64-unknown-linux-gnu': null,
    'ffprobe-aarch64-apple-darwin': null,
    'ffprobe-x86_64-apple-darwin': null,
    'ffprobe-x86_64-pc-windows-msvc.exe': null,
    'ffprobe-x86_64-unknown-linux-gnu': null,
    'mkvmerge-aarch64-apple-darwin': null,
    'mkvmerge-x86_64-apple-darwin': null,
    'mkvmerge-x86_64-pc-windows-msvc.exe': null,
    'mkvmerge-x86_64-unknown-linux-gnu': null
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