// The task report: a PDF made in this page (pdfmake, MIT, game/vendor) whenever a task on Harm's to-do list is done.
// What was done, everything the team did (step by step, with times), the results, drafts, calendar items, and
// what Harm still has to do. Nothing leaves the page: the PDF is built here and saved with Harm's OK.

const REPORT = {
  ink: '#2a1c0e', soft: '#6b5640', gold: '#c8962e', goldLight: '#f3e3bf', cream: '#fbf6ec', paper: '#ffffff',
  line: '#e6d6b4', green: '#4f7a3a', red: '#9a3b2a',
};
let pdfReady = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Kon niet laden: ' + src));
    document.head.appendChild(s);
  });
}
// pdfmake 0.2.10 from cdnjs (a pinned version); a local copy in game/vendor is only for running the village offline.
const PDFMAKE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/';
function loadPdfMake() {
  if (!pdfReady) {
    const from = (base) => loadScriptOnce(base + 'pdfmake.min.js').then(() => loadScriptOnce(base + 'vfs_fonts.js'));
    pdfReady = from(PDFMAKE_CDN).catch(() => from('game/vendor/')).catch((e) => { pdfReady = null; throw e; });
  }
  return pdfReady;
}

// The PDF font has no emoji: keep letters, numbers and normal punctuation.
function pdfText(s) {
  return String(s ?? '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\r/g, '').trim();
}

async function portraitData(id) {
  try {
    const res = await fetch(`assets/portraits/${id}.jpg`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(blob); });
  } catch (e) { return null; }
}

function whoName(id) {
  if (id === 'harm') return 'Harm';
  if (id === 'office') return 'Dorp';
  const p = typeof personById === 'function' ? personById(id) : null;
  return p ? p.name : String(id || '');
}
function whoRole(id) {
  if (id === 'harm') return 'Chief Human Officer';
  if (id === 'kevin') return 'Stafchef';
  const p = typeof personById === 'function' ? personById(id) : null;
  if (!p) return '';
  return p.role === 'Director' ? `Directeur, ${p.building.job.toLowerCase()}` : `Stagiair, ${p.building.name}`;
}

function niceDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function clock(iso) { return iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''; }
function duration(a, b) {
  if (!a || !b) return '';
  const s = Math.max(0, Math.round((new Date(b) - new Date(a)) / 1000));
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} u ${m % 60} min`;
}

// A section title stays on the same page as the first thing under it.
function titled(text, first) { return { stack: [sectionTitle(text), first], unbreakable: true }; }

function sectionTitle(text) {
  return { margin: [0, 22, 0, 8], stack: [
    { text: text.toUpperCase(), fontSize: 9.5, bold: true, characterSpacing: 1.6, color: REPORT.gold },
    { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 36, y2: 4, lineWidth: 1.6, lineColor: REPORT.gold }] },
  ] };
}

// A box with a coloured left edge.
function callout(stack, fill, edge) {
  return { table: { widths: [3, '*'], dontBreakRows: true, body: [[{ text: '', fillColor: edge }, { stack, fillColor: fill, margin: [12, 10, 12, 10] }]] },
    layout: 'noBorders', margin: [0, 0, 0, 4] };
}

function statTile(num, label) {
  return { stack: [
    { text: String(num), fontSize: 22, bold: true, color: REPORT.ink, alignment: 'center' },
    { text: label, fontSize: 8.5, color: REPORT.soft, alignment: 'center', margin: [0, 2, 0, 0] },
  ], fillColor: REPORT.paper, margin: [0, 10, 0, 10] };
}

function card(title, bodyStack) {
  return { table: { widths: ['*'], dontBreakRows: true, body: [[{ stack: [
    { text: pdfText(title), bold: true, fontSize: 11.5, color: REPORT.ink, margin: [0, 0, 0, 5] }, ...bodyStack,
  ], margin: [12, 10, 12, 10] }]] },
  layout: { hLineColor: () => REPORT.line, vLineColor: () => REPORT.line, hLineWidth: () => 0.8, vLineWidth: () => 0.8, fillColor: () => REPORT.paper },
  margin: [0, 0, 0, 8] };
}

async function makeTaskReport(t) {
  await loadPdfMake();
  const chain = ['harm', 'kevin', t.owner, t.worker].filter(Boolean);
  const faces = await Promise.all(chain.map(portraitData));
  const done = t.status === 'done';
  const couldNot = t.outcome === 'could_not';
  const drafts = t.drafts || [], approvals = t.approvals || [], log = t.log || [];
  const toolsUsed = log.filter((l) => l.tool).length;

  const pill = { table: { body: [[{ text: couldNot ? 'NIET GELUKT' : done ? 'KLAAR' : 'BEZIG', bold: true, fontSize: 8.5, characterSpacing: 1.2,
    color: '#ffffff', fillColor: couldNot ? REPORT.red : done ? REPORT.green : REPORT.gold, margin: [8, 3, 8, 2] }]] }, layout: 'noBorders' };

  const people = {
    columns: chain.flatMap((id, i) => {
      const col = { width: 'auto', stack: [
        faces[i] ? { image: faces[i], width: 54, height: 54, alignment: 'center' }
          : { canvas: [{ type: 'rect', x: 0, y: 0, w: 54, h: 54, r: 6, color: REPORT.goldLight }], alignment: 'center' },
        { text: whoName(id), bold: true, fontSize: 9.5, color: REPORT.ink, alignment: 'center', margin: [0, 5, 0, 0] },
        { text: whoRole(id), fontSize: 7.5, color: REPORT.soft, alignment: 'center' },
      ] };
      const sized = { width: 92, stack: [col] };
      return i < chain.length - 1 ? [sized, { width: 18, margin: [0, 24, 0, 0], canvas: [{ type: 'line', x1: 1, y1: 4, x2: 13, y2: 4, lineWidth: 1.4, lineColor: REPORT.gold }, { type: 'polyline', closePath: true, color: REPORT.gold, lineColor: REPORT.gold, points: [{ x: 12, y: 0 }, { x: 18, y: 4 }, { x: 12, y: 8 }] }] }] : [sized];
    }),
    columnGap: 4,
  };

  const content = [
    { text: pdfText(t.text), fontSize: 24, bold: true, color: REPORT.ink, lineHeight: 1.1, margin: [0, 0, 0, 8] },
    { columns: [
      { width: 'auto', stack: [pill] },
      { width: '*', text: [
        { text: 'Toegevoegd ', color: REPORT.soft }, niceDate(t.createdAt),
        ...(t.doneAt ? [{ text: '   ·   Klaar ', color: REPORT.soft }, niceDate(t.doneAt), { text: '   ·   ', color: REPORT.soft }, duration(t.createdAt, t.doneAt)] : []),
      ], fontSize: 9, color: REPORT.ink, margin: [10, 3, 0, 0] },
    ] },
    { text: t.from === 'chat' ? `Harm vroeg het ${whoName(t.askedPerson)} persoonlijk: "${pdfText(t.words)}"` : 'Van Harms takenlijst.',
      fontSize: 9, italics: true, color: REPORT.soft, margin: [0, 8, 0, 0] },
    { table: { widths: ['*', '*', '*', '*'], body: [[
      statTile(log.length, 'stappen vastgelegd'), statTile(toolsUsed, 'keer gezocht in mail, agenda & apps'),
      statTile(drafts.length, drafts.length === 1 ? 'concept geschreven' : 'concepten geschreven'), statTile(approvals.length, 'agenda- & app-wijzigingen'),
    ]] }, layout: { hLineColor: () => REPORT.line, vLineColor: () => REPORT.line, hLineWidth: () => 0.8, vLineWidth: () => 0.8 }, margin: [0, 16, 0, 0] },

    titled('In het kort', callout([{ text: pdfText(t.summary) || 'Het team heeft deze taak afgerond.', fontSize: 11.5, lineHeight: 1.35, color: REPORT.ink }], REPORT.goldLight, REPORT.gold)),

    ...(t.noteForHarm ? [titled('Voor jou', callout([{ text: pdfText(t.noteForHarm), fontSize: 11, bold: true, color: REPORT.ink, lineHeight: 1.3 }], '#eef3e6', REPORT.green))] : []),

    titled('Wie het deden', people),
  ];

  if (t.kevinWhy) content.push({ text: [{ text: 'Waarom deze directeur: ', bold: true }, pdfText(t.kevinWhy)], fontSize: 9, color: REPORT.soft, margin: [0, 10, 0, 0] });

  if ((t.whatWasDone || []).length) {
    content.push(sectionTitle('Wat er is gedaan'));
    content.push({ table: { widths: [22, '*'], body: t.whatWasDone.map((step, i) => [
      { text: String(i + 1), bold: true, color: REPORT.gold, fontSize: 11, alignment: 'right', margin: [0, 1, 6, 0] },
      { text: pdfText(step), fontSize: 10.5, lineHeight: 1.3, color: REPORT.ink, margin: [0, 1, 0, 5] },
    ]) }, layout: 'noBorders' });
  }

  if ((t.results || []).length) {
    t.results.forEach((r, i) => { const c = card(r.title || 'Resultaat', [{ text: pdfText(r.body), fontSize: 10, lineHeight: 1.35, color: REPORT.ink }]); content.push(i ? c : titled('Resultaten', c)); });
  }

  if (drafts.length) {
    drafts.forEach((d, i) => { const c = card(d.subject || '(geen onderwerp)', [
      { text: [{ text: 'Aan: ', color: REPORT.soft }, (d.to || []).join(', ') || '(antwoord in hetzelfde gesprek)', { text: '   ·   geschreven door ', color: REPORT.soft }, whoName(d.by)], fontSize: 9, margin: [0, 0, 0, 6] },
      { text: pdfText(d.body), fontSize: 9.5, lineHeight: 1.35, color: REPORT.ink },
      ...(d.url ? [{ text: 'Open het concept in Gmail', link: d.url, color: REPORT.gold, decoration: 'underline', fontSize: 9, margin: [0, 6, 0, 0] }] : []),
      { text: 'Niet verstuurd. Het staat in je map Concepten, zodat jij het kunt nakijken en versturen.', fontSize: 8, italics: true, color: REPORT.soft, margin: [0, 4, 0, 0] },
    ]); content.push(i ? c : titled('Concepten in je Gmail', c)); });
  }

  if (approvals.length) {
    content.push(titled('Agenda- en app-wijzigingen', { table: { widths: ['*', 'auto', 'auto'], headerRows: 1, body: [
      ['Wat', 'Wanneer', 'Status'].map((h) => ({ text: h, bold: true, fontSize: 8.5, color: REPORT.soft, margin: [0, 2, 0, 2] })),
      ...approvals.map((a) => [
        { stack: [{ text: pdfText(a.kind === 'app' ? `${a.app}: ${a.what}` : (a.payload.summary || a.what)), fontSize: 10, color: REPORT.ink },
          ...(a.kind !== 'app' && a.what && a.payload.summary ? [{ text: pdfText(a.what), fontSize: 8.5, color: REPORT.soft }] : []),
          ...(a.url ? [{ text: 'Openen in Google Agenda', link: a.url, color: REPORT.gold, decoration: 'underline', fontSize: 8.5 }] : [])] },
        { text: a.kind === 'app' ? '' : (a.payload.startTime || '').replace('T', ' ').slice(0, 16) + (a.payload.endTime ? ' – ' + a.payload.endTime.slice(11, 16) : ''), fontSize: 9.5, color: REPORT.ink },
        { text: a.status === 'done' ? 'Gedaan (jij keurde goed)' : a.status === 'declined' ? 'Door jou afgewezen' : 'Wacht op jou', fontSize: 9.5,
          color: a.status === 'done' ? REPORT.green : a.status === 'declined' ? REPORT.red : REPORT.gold, bold: true },
      ]),
    ] }, layout: { hLineColor: () => REPORT.line, vLineWidth: () => 0, hLineWidth: (i) => (i === 0 ? 0 : 0.8), paddingTop: () => 6, paddingBottom: () => 6 } }));
  }

  if (t.suspicious) {
    content.push(titled('Let op', callout([{ text: pdfText(t.suspicious), fontSize: 10.5, color: REPORT.ink, lineHeight: 1.35 }], '#fbeaea', REPORT.red)));
  }

  if ((t.sources || []).length) {
    content.push(titled('Bronnen', { stack: t.sources.map((x, i) => ({ text: [{ text: `${i + 1}. `, color: REPORT.gold, bold: true }, { text: pdfText(x.title), link: x.url, color: REPORT.ink, decoration: 'underline' }, { text: '\n' + String(x.url).slice(0, 110), fontSize: 7.5, color: REPORT.soft }], fontSize: 9.5, margin: [0, 0, 0, 5] })) }));
  }

  if ((t.workerReports || []).length) {
    t.workerReports.forEach((w, i) => { const c = callout([{ text: pdfText(w.text).slice(0, 3500), fontSize: 9.5, lineHeight: 1.35, color: REPORT.ink }], REPORT.paper, REPORT.line); content.push(i ? c : titled(`Verslag van ${whoName(t.worker)} aan ${whoName(t.owner)}`, c)); });
    content.push({ text: `${whoName(t.owner)} controleerde dit werk voordat het telde.`, fontSize: 8.5, italics: true, color: REPORT.soft, margin: [0, 2, 0, 0] });
  }


  content.push({ table: { widths: [52, 92, '*'], headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, body: [
    [{ ...sectionTitle('Alles wat we deden, stap voor stap'), colSpan: 3, margin: [-6, 16, 0, 2] }, {}, {}],
    ['Tijd', 'Wie', 'Wat er gebeurde'].map((h) => ({ text: h, bold: true, fontSize: 8.5, color: REPORT.soft })),
    ...log.map((l) => [
      { text: clock(l.at), fontSize: 8.5, color: REPORT.soft },
      { text: whoName(l.who), fontSize: 8.5, bold: true, color: REPORT.ink },
      { stack: [{ text: pdfText(l.text), fontSize: 9, color: REPORT.ink, lineHeight: 1.25 },
        ...(l.link ? [{ text: 'link', link: l.link, color: REPORT.gold, decoration: 'underline', fontSize: 8 }] : [])] },
    ]),
  ] }, layout: { fillColor: (i) => (i > 1 && i % 2 === 1 ? '#f6eedc' : null), hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 6, paddingRight: () => 6 } });

  content.push({ text: 'Zo is het gedaan: Kevin en de directeuren denken met Opus 5.5 (met een adviseur op Fable 5.1), de stagiairs met Sonnet 5.5, allemaal op Harms eigen Claude-abonnement. Gmail: alleen lezen en concepten, niets verstuurd. Agenda en apps: wijzigingen alleen na Harms Goedkeuren.',
    fontSize: 7.5, color: REPORT.soft, italics: true, margin: [0, 18, 0, 0] });

  const doc = {
    pageSize: 'A4',
    pageMargins: [48, 92, 48, 56],
    info: { title: `Taakrapport: ${pdfText(t.text)}`, author: 'Mijn AI-dorp', subject: 'Taakrapport' },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: REPORT.ink },
    background: (page, size) => [
      { canvas: [
        { type: 'rect', x: 0, y: 0, w: size.width, h: size.height, color: REPORT.cream },
        ...(page === 1 ? [{ type: 'rect', x: 0, y: 0, w: size.width, h: 66, color: REPORT.ink }, { type: 'rect', x: 0, y: 66, w: size.width, h: 3, color: REPORT.gold }]
          : [{ type: 'line', x1: 48, y1: 62, x2: size.width - 48, y2: 62, lineWidth: 0.6, lineColor: REPORT.line }]),
      ] },
    ],
    header: (page) => (page === 1
      ? { columns: [
        { text: [{ text: 'MIJN AI-DORP', bold: true, color: REPORT.gold, characterSpacing: 2.4 }, { text: '   ·   TAAKRAPPORT', color: '#e8d7b6', characterSpacing: 1.6 }], fontSize: 10 },
        { text: niceDate(t.doneAt || t.updatedAt || t.createdAt), alignment: 'right', fontSize: 8.5, color: '#e8d7b6' },
      ], margin: [48, 27, 48, 0] }
      : { columns: [
        { text: [{ text: 'MIJN AI-DORP', bold: true, color: REPORT.gold, characterSpacing: 2 }, { text: '  ·  ' + pdfText(t.text).slice(0, 70), color: REPORT.soft }], fontSize: 8 },
      ], margin: [48, 44, 48, 0] }),
    footer: (page, pages) => ({ columns: [
      { text: `Gemaakt door het dorp voor Harm · ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`, fontSize: 7.5, color: REPORT.soft },
      { text: `${page} / ${pages}`, alignment: 'right', fontSize: 7.5, color: REPORT.soft },
    ], margin: [48, 22, 48, 0] }),
    content,
  };
  return new Promise((resolve, reject) => {
    try { pdfMake.createPdf(doc).getBlob((blob) => resolve(blob)); } catch (e) { reject(e); }
  });
}
