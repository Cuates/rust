import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// 1. Get the current directory of this script file
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 2. Resolve the path to the sidecars directory relative to this script
// This goes up one level to 'mkv-filter-metadata', then down into 'backend/sidecars'
const TARGET_DIR = path.resolve(__dirname, '../backend/sidecars');

function generateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

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

const results = {};

console.log(`Looking for binaries in: ${TARGET_DIR}\n`);

for (const file of sidecars) {
    const filePath = path.join(TARGET_DIR, file);
    if (fs.existsSync(filePath)) {
        results[file] = generateHash(filePath);
    } else {
        results[file] = "FILE_NOT_FOUND";
    }
}

console.log("Copy and paste this into your download-sidecars.mjs:");
console.log(JSON.stringify(results, null, 4));