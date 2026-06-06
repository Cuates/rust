import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

// Replace this with the URL of the GitHub Release you created in Phase 2
const REPO_URL = "https://github.com/Cuates/rust/releases/download/v1.0.0-binaries";
const TARGET_DIR = path.resolve(process.cwd(), 'backend/sidecars');

const sidecars = [
    'ffmpeg-aarch64-apple-darwin',
    'ffmpeg-x86_64-apple-darwin',
    'ffmpeg-x86_64-pc-windows-msvc.exe',
    'ffmpeg-x86_64-unknown-linux-gnu',
    'ffprobe-aarch64-apple-darwin',
    'ffprobe-x86_64-apple-darwin',
    'ffprobe-x86_64-pc-windows-msvc.exe',
    'ffprobe-x86_64-unknown-linux-gnu',
    'mkvmerge-aarch64-apple-darwin',
    'mkvmerge-x86_64-apple-darwin',
    'mkvmerge-x86_64-pc-windows-msvc.exe',
    'mkvmerge-x86_64-unknown-linux-gnu'
];

async function downloadFile(filename) {
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

    // Ensure the binary is executable on macOS/Linux
    if (!filename.endsWith('.exe')) {
        fs.chmodSync(destination, 0o755);
    }

    console.log(`✅ Successfully downloaded ${filename}`);
}

async function main() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    try {
        await Promise.all(sidecars.map(downloadFile));
        console.log("🎉 All sidecars are ready!");
    } catch (error) {
        console.error("❌ Error downloading sidecars:", error);
        process.exit(1);
    }
}

main();