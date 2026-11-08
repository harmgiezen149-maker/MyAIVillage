// Shared helpers for the village tests: a small web server for ai-village/, a browser, and fake versions of
// Claude (`sample`), Harm's connectors (`mcp`) and the page database (`db`). Nothing real is ever called.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

function startServer() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/index.html` })));
}

// Runs inside the page, before its own scripts. cfg is plain data from the test.
function installFake(cfg) {
  cfg = cfg || {};
  const store = {};
  // like the real page database: what comes back is a read-only copy
  const frozen = (v) => { const c = JSON.parse(JSON.stringify(v)); const deep = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deep); Object.freeze(o); } return o; }; return deep(c); };
  const docsUnder = (prefix) => Object.keys(store).filter((k) => k.startsWith(prefix + '/') && !k.slice(prefix.length + 1).includes('/'))
    .map((k) => ({ id: k.slice(prefix.length + 1), data: () => frozen(store[k]) }));
  const coll = (prefix) => ({ get: async () => ({ docs: docsUnder(prefix) }), orderBy: () => ({ limit: () => ({ get: async () => ({ docs: docsUnder(prefix) }) }) }) });
  const db = { doc: (k) => ({ set: async (v) => { store[k] = JSON.parse(JSON.stringify(v)); }, get: async () => ({ exists: !!store[k], data: () => (store[k] ? frozen(store[k]) : undefined) }), delete: async () => { delete store[k]; } }), collection: coll };
  const all = (i) => (typeof i === 'string' ? i : i.map((x) => x.content).join('\n'));
  const f = window.__fake = { store, prompts: [], calls: [], mcp: [], active: 0, maxActive: 0, badJsonOnce: !!cfg.badJsonOnce, calFailOnce: !!cfg.calFailOnce, failOnce: cfg.failOnce || null };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function sample(input, opts = {}) {
    const text = all(input); f.prompts.push(text); f.calls.push({ model: opts.model || '-', tools: (opts.tools || []).map((t) => t.name) });
    const said = Array.isArray(input) ? String(input[input.length - 1].content) : text;
    const tool = (n) => (opts.tools || []).find((t) => t.name === n);
    if (tool('propose_save') && /opslaan/i.test(said)) { await tool('propose_save').execute({ experiences: [{ datum: '08-11-2026', ervaring: 'Fietstocht naar huis in de zon', waarom: 'Even tijd voor mezelf', gevoel: 'Rustig', sterkte: 70, reflectie: 'Ik neem de tijd voor mijzelf > ik weet wat mij helpt' }] }); return { text: 'Dan kun je ze opslaan met de knop.' }; }
    if (tool('read_empty_reflections') && /lege reflecties/i.test(said)) { const out = JSON.parse(await tool('read_empty_reflections').execute({})); f.emptyRows = out; return { text: `Er zijn ${out.zonder_reflectie} ervaringen zonder reflectie.` }; }
    if (tool('propose_fill') && /vul in/i.test(said)) { await tool('propose_fill').execute({ items: [{ rij: 2, ervaring: f.emptyRows.rijen[0].ervaring, reflectie: 'Ik ben een teamplayer' }] }); return { text: 'Opslaan kan met de knop.' }; }
    if (tool('propose_save')) { f.sessionPrompt = Array.isArray(input) ? String(input[0].content) : ''; return { text: 'Wat maakte dat fijn voor jou?' }; }
    if (tool('create_task') && /inbox/i.test(said)) { await tool('create_task').execute({ task: 'Sorteer mijn inbox' }); return { text: 'Komt goed, ik geef het aan Margot.' }; }
    return { text: tool('hand_to_worker') ? 'ok' : 'Hallo Harm.' };
  }
  sample.json = async (input, opts = {}) => {
    const text = all(input); f.prompts.push(text); f.calls.push({ model: opts.model || '-', tools: (opts.tools || []).map((t) => t.name) });
    if (text.includes('Pick the ONE director')) {
      const asked = (text.match(/to-do list:\s*"([^"]*)"/) || [])[1] || '';
      const many = /iedere directeur/i.test(asked) ? DIRECTORS.map((d) => d.id) : [];
      return { director: cfg.director || 'rosie-bell', directors: many, why: 'past bij het onderwerp', brief: 'Doe dit.', callLine: 'Hoi, Harm heeft iets voor je.' };
    }
    if (text.includes('Bundle this for Harm')) return { summary: 'Alles op een rij.', results: [{ title: 'Iedereen', body: 'punten' }], top3: ['Eerste', 'Tweede', 'Derde'], noteForHarm: '' };
    if (text.includes('Turn this report into the JSON')) return { status: 'done', summary: 'Gered uit de ruwe tekst.', whatWasDone: ['x'], results: [], noteForHarm: '' };
    if (opts.tools) {
      f.active++; f.maxActive = Math.max(f.maxActive, f.active);
      try {
        await wait(60);
        if (f.failOnce && text.includes(f.failOnce)) { f.failOnce = null; throw { code: 'rate_limited', message: 'limit' }; }
        const t = (n) => opts.tools.find((x) => x.name === n);
        if (cfg.useNet) { try { await t('internet').execute({ action: 'web_search', query: 'Claude' }); } catch (e) { f.netError = e.message; } }
        if (cfg.draftAndEvent) {
          await t('gmail_create_draft').execute({ to: ['a@b.nl'], subject: 'Hallo', body: 'x' });
          await t('calendar_propose_event').execute({ summary: 'Etentje', startTime: '2026-11-06T19:00:00', endTime: '2026-11-06T21:00:00' });
        }
        if (f.badJsonOnce) { f.badJsonOnce = false; throw { code: 'invalid_json', message: 'bad', text: 'Ik heb een concept geschreven en een etentje voorgesteld.' }; }
        return { status: 'done', summary: 'Klaar met het werk.', whatWasDone: ['gedaan'], results: [{ title: 'Uitkomst', body: 'iets' }], noteForHarm: '', sources: [{ title: 'Bron', url: 'https://example.org/a' }] };
      } finally { f.active--; }
    }
    if (text.includes('Did they agree')) return { committed: false };
    return {};
  };
  // a fake Google Drive with Harm's list as one spreadsheet (read back as a markdown table, like the real one)
  const drive = f.drive = { files: { L1: { title: 'Positieve ervaringen - Harm', rows: [
    ['01-11-2026', 'Samen met collega\'s NOVA-stappen gezet', 'Het ging vooruit', 'Trots', '60', ''],
    ['02-11-2026', 'Repetitie met de band', 'Muziek maken', 'Plezier', '80', 'Ik hoor erbij'],
  ] } }, trashed: [], created: [] };
  const asTable = (rows) => `### Table Range: A1:F${rows.length + 1}\n| Datum | Ervaring | Waarom het fijn was | Gevoel | Sterkte (0-100) | Reflexie |\n|---|---|---|---|---|---|\n`
    + rows.map((r) => '| ' + r.map((c) => c.replace(/>/g, '\\>')).join(' | ') + ' |').join('\n');
  const parseCsv = (csv) => { const out = []; let row = [], cell = '', q = false; for (let i = 0; i < csv.length; i++) { const ch = csv[i];
    if (q) { if (ch === '"' && csv[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; } else cell += ch; }
    return out.slice(1); };
  async function driveTool(tool, input) {
    if (tool === 'search_files') return { files: Object.entries(drive.files).filter(([id, x]) => !drive.trashed.includes(id) && x.title === 'Positieve ervaringen - Harm').map(([id, x]) => ({ id, title: x.title, viewUrl: 'https://docs.google.com/spreadsheets/d/' + id })).reverse() };
    if (tool === 'read_file_content') return { content: asTable(drive.files[input.fileId].rows) };
    if (tool === 'create_file') { const id = 'L' + (Object.keys(drive.files).length + 1); drive.files[id] = { title: input.title, rows: parseCsv(input.textContent), csv: input.textContent }; drive.created.push(id); return { id, viewUrl: 'https://docs.google.com/spreadsheets/d/' + id }; }
    if (tool === 'trash_file') { drive.trashed.push(input.fileId); return {}; }
    return {};
  }
  const mcp = { callTool: async (server, tool, input) => {
    f.mcp.push(server + ':' + tool);
    if (server === 'Google Drive') return { payload: await driveTool(tool, input) };
    if ((server === 'Dorpsinternet' || server === 'Internet') && cfg.netUnconfirmed && !f.netAllowed) throw { code: 'unconfirmed', message: "connector access isn't confirmed for this artifact right now" };
    if (tool === 'create_draft') return { payload: { id: 'd1' } };
    if (tool === 'create_event') { if (f.calFailOnce) { f.calFailOnce = false; throw { code: 'server_unavailable', message: 'timeout' }; } return { payload: {} }; }
    if (tool === 'list_events') return { payload: { events: [{ summary: 'Etentje' }] } };
    if (tool === 'list_calendars') return { payload: { calendars: [{ id: 'primary', summary: 'Harm' }] } };
    return { payload: {} };
  } };
  const caps = { db, sample, mcp, downloads: { save: async () => ({}) } };
  window.claude = { use: async (n) => (cfg.noClaude ? null : caps[n] || null) };
}

// Opens the village and walks in. Returns { browser, page, errors, close }.
async function openVillage(url, { phone = false, fake = {} } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(installFake, fake);
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('enter').disabled, null, { timeout: 60000 });
  if (phone) await page.tap('#enter'); else await page.click('#enter');
  await page.waitForTimeout(500);
  return { browser, page, errors, close: () => browser.close() };
}

module.exports = { startServer, openVillage };
