import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

// Replace this with the URL of the GitHub Release you created in Phase 2
// NOTE: The hash map below is tightly coupled to the binaries hosted at this URL.
// If you update the URL or rebuild the binaries, you MUST regenerate and update the hashes below.
const REPO_URL = "https://github.com/Cuates/rust/releases/download/v2.0.0-binaries";
const TARGET_DIR = path.resolve(process.cwd(), 'backend/sidecars');

// Map of filename to expected SHA-256 hash.
// Replace null with actual hashes for production security.
const sidecars = {
    "ffmpeg-aarch64-apple-darwin": "591260c945d0eef150e3bf82b0ef988bd36a9cecc18ff05d6679617159f0a95e",
    "ffmpeg-x86_64-apple-darwin": "f6db556b9e00083dbb22fc28c2370e07f1373a5402a20bfd3b22dd33cc6eeb8f",
    "ffmpeg-x86_64-pc-windows-msvc.exe": "227af0691433b703ffc5725e47f7d06eefc34b4a72e7870e73d30e2cda483ecf",
    "ffmpeg-x86_64-unknown-linux-gnu": "e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99",
    "ffprobe-aarch64-apple-darwin": "e11c17e8200b3ee4c4c186d245e2b4053f01d56957336c1817fca0b997469106",
    "ffprobe-x86_64-apple-darwin": "248c015ea397b31a342029d7693baf284d2396895726dad3b1ea17905d6f2f20",
    "ffprobe-x86_64-pc-windows-msvc.exe": "901f0efe4793cbb0f017101e3427f816e8fbf9a407bd585f49df30f4325cfd88",
    "ffprobe-x86_64-unknown-linux-gnu": "4f231a1960d83e403d08f7971e271707bec278a9ae18e21b8b5b03186668450d"
};

async function verifyChecksum(filePath, expectedHash) {
    if (!expectedHash || expectedHash === "FILE_NOT_FOUND") {
        throw new Error("Strict hash verification failed: No valid hash provided.");
    }

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
        const isValid = await verifyChecksum(destination, expectedHash);
        if (isValid) {
            console.log(`✅ Skipped ${filename} (hash verified)`);
            return;
        }
        console.warn(`⚠️ Hash mismatch on existing ${filename} – re-downloading`);
        fs.unlinkSync(destination); // fall through to download
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