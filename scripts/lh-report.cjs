const fs = require('fs');
const d = fs.readFileSync(0, 'utf8');
const j = JSON.parse(d);
const c = j.categories.performance;
const a = j.audits;

console.log('Score:', Math.round(c.score * 100));
console.log('FCP:', a['first-contentful-paint'].displayValue);
console.log('LCP:', a['largest-contentful-paint'].displayValue);
console.log('TBT:', a['total-blocking-time'].displayValue);
console.log('CLS:', a['cumulative-layout-shift'].displayValue);
console.log('SI:', a['speed-index'].displayValue);

const np = a['network-requests'];
if (np?.details?.items) {
  const total = np.details.items.reduce((s, i) => s + (i.transferSize || 0), 0);
  console.log('Total payload:', Math.round(total / 1024) + 'KB');
  const fonts = np.details.items.filter(i => i.url.includes('/font/'));
  console.log('Fonts:', fonts.length + ' files,', Math.round(fonts.reduce((s, i) => s + i.transferSize, 0) / 1024) + 'KB');
  fonts.forEach(f => console.log('  ' + Math.round(f.transferSize / 1024) + 'KB', f.url.slice(-50)));
}

const diag = a['diagnostics'];
if (diag?.details?.items) {
  const fontItems = diag.details.items.filter(i => i.url?.includes('/font/'));
  if (fontItems.length > 0) {
    console.log('Font diagnostics:');
    fontItems.forEach(i => console.log('  ' + i.url?.slice(-40), Math.round(i.transferSize / 1024) + 'KB'));
  }
}
