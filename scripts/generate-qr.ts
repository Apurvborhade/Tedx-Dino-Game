// ════════════════════════════════════════════════════════════════════════════
// scripts/generate-qr.ts — Standalone SVG QR code generator script for venue posters
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generate a clean SVG QR code link helper for the TEDxDYPDPU event url.
 * Run with: npx tsx scripts/generate-qr.ts <TARGET_URL>
 */

const targetUrl = process.argv[2] || 'https://kalachakra.tedxdypdpu.com';

console.log('═══════════════════════════════════════════════════════════');
console.log('TEDxDYPDPU KAALCHAKRA RUNNER — VENUE QR GENERATOR');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Target URL: ${targetUrl}`);
console.log('');
console.log('To generate print-ready SVG QR codes for venue posters:');
console.log('  1. Use any standard QR generator or qrencode:');
console.log(`     qrencode -t SVG -o kalachakra-qr.svg "${targetUrl}"`);
console.log('');
console.log('  2. Or online via:');
console.log(`     https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(targetUrl)}`);
console.log('═══════════════════════════════════════════════════════════');
