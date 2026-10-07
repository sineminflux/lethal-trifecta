// Render check for the 708x400 embed.
// Usage: node check-render.cjs <url-or-file-url> [shots]
// Needs: npm i puppeteer-core, and Google Chrome installed.
const puppeteer = require('puppeteer-core');
const url = process.argv[2] || 'https://sineminflux.github.io/lethal-trifecta/';
const shots = process.argv[3] === 'shots';
const sizes = [[708, 400], [629, 354], [560, 315], [375, 211], [629, 416], [708, 520]];
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const states = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2], ['ask'], ['all']];
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: chrome, headless: 'new' });
  let fails = 0;
  for (const [w, h] of sizes) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await p.goto(url, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const fonts = await p.evaluate(() => document.fonts.check('16px "Season Mix"') && document.fonts.check('16px Inter'));
    if (!fonts) { fails++; console.log(`FAIL ${w}x${h} fonts not loaded`); }
    for (const s of states) {
      await p.evaluate(() => document.getElementById('reset').click());
      const clicks = typeof s[0] === 'string' ? [0, 1, 2] : s;
      for (const i of clicks) await p.evaluate(i => document.querySelectorAll('.toggle')[i].click(), i);
      if (s[0] === 'all') await p.evaluate(() => document.querySelector('[data-guess=exposed]').click());
      await wait(120);
      const issues = await p.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const card = document.querySelector('.card').getBoundingClientRect();
        const panel = document.getElementById('panel');
        const pr = panel.getBoundingClientRect();
        const out = [];
        if (document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls');
        document.querySelectorAll('.card *').forEach(e => {
          if (!vis(e)) return;
          const r = e.getBoundingClientRect();
          if (r.bottom > card.bottom + .5 || r.right > card.right + .5 || r.top < card.top - .5 || r.left < card.left - .5) out.push('outside card: ' + e.tagName + '.' + e.className);
        });
        panel.querySelectorAll('*').forEach(e => {
          if (!vis(e)) return;
          const r = e.getBoundingClientRect();
          if (r.bottom > pr.bottom - 2 || r.top < pr.top + 2 || r.right > pr.right - 2) out.push('clipped in panel: ' + e.tagName + ' "' + (e.textContent || '').slice(0, 28) + '"');
        });
        document.querySelectorAll('.t-name,.t-ex,h1,.credit,.reset').forEach(e => {
          if (vis(e) && e.scrollWidth > e.clientWidth + 1) out.push('truncated: ' + (e.className || e.tagName));
        });
        return out;
      });
      if (issues.length) { fails++; console.log(`FAIL ${w}x${h} state ${s.join('+') || 'none'}: ${[...new Set(issues)].join(' | ')}`); }
      if (shots && (s[0] === 'all' || !s.length)) await p.screenshot({ path: `shot-${w}x${h}-${s[0] || 'none'}.png` });
    }
    await p.close();
  }
  await b.close();
  console.log(fails ? `${fails} failure(s)` : `PASS: ${sizes.length} sizes x ${states.length} states, nothing clipped, nothing scrolls`);
  process.exit(fails ? 1 : 0);
})();
