import { readFileSync, writeFileSync } from 'fs';

// Read PNG files
const png16 = readFileSync('apps/web/public/favicon-16.png');
const png32 = readFileSync('apps/web/public/favicon-32.png');

// Build ICO file
// Header: Reserved(2) + Type(2) + Count(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // Type: ICO
header.writeUInt16LE(2, 4); // Count: 2 images

// Directory entries (16 bytes each)
const dir16 = Buffer.alloc(16);
dir16.writeUInt8(16, 0);  // Width
dir16.writeUInt8(16, 1);  // Height
dir16.writeUInt8(0, 2);   // Palette
dir16.writeUInt8(0, 3);   // Reserved
dir16.writeUInt16LE(1, 4); // Planes
dir16.writeUInt16LE(32, 6); // BPP
dir16.writeUInt32LE(png16.length, 8); // Size
dir16.writeUInt32LE(6 + 32, 12); // Offset (header + 2 dir entries)

const dir32 = Buffer.alloc(16);
dir32.writeUInt8(32, 0);
dir32.writeUInt8(32, 1);
dir32.writeUInt8(0, 2);
dir32.writeUInt8(0, 3);
dir32.writeUInt16LE(1, 4);
dir32.writeUInt16LE(32, 6);
dir32.writeUInt32LE(png32.length, 8);
dir32.writeUInt32LE(6 + 32 + png16.length, 12);

const ico = Buffer.concat([header, dir16, dir32, png16, png32]);
writeFileSync('apps/web/public/favicon.ico', ico);
console.log(`favicon.ico created: ${ico.length} bytes (was 181,614 bytes)`);
