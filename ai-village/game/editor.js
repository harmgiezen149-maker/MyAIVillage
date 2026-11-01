// Paint mode (key E): correct where the character may walk and what he goes under or behind.
// Corrections are saved into the page's own storage on claude.ai, where Claude can read them.

const TOOLS = [
  { key: '1', label: 'Begaanbaar', layer: 'walk', value: 1, color: '60,200,90' },
  { key: '2', label: 'Geblokkeerd', layer: 'walk', value: 0, color: '230,60,50' },
  { key: '3', label: 'Eronder', hint: 'altijd boven hem: boomkruinen, daken', layer: 'cover', value: 1, color: '70,140,255' },
  { key: '4', label: 'Erachter', hint: 'boven hem als hij erachter loopt', layer: 'cover', value: 2, color: '255,200,0' },
  { key: '5', label: 'Geen dekking', layer: 'cover', value: 0, color: '255,255,255' },
  { key: '6', label: 'Props verplaatsen', hint: 'sleep een bankje, lantaarn, ton of de jukebox naar een andere plek', mode: 'props', color: '200,130,255' },
];

const editor = {
  on: false,
  tool: TOOLS[0],
  brush: 3,               // radius in cells
  mouse: null,            // world position under the pointer
  stroke: null,
  lastPaint: null,
  panning: null,
  undo: [],
  changed: new Set(),     // places with unsaved changes
  tint: document.createElement('canvas'),
  tintFor: '',
  tintDirty: true,
  drag: null,             // the prop being moved
  propsChanged: false,
};

// ---------- props (Harm, 2026-11-01: "laat me de props verplaatsen") ----------

const PROP_DEFAULTS = {
  map: MAP_PROPS.map((p) => [p[1], p[2]]),
  rooms: Object.fromEntries(Object.entries(ROOMS).map(([id, r]) => [id, (r.props || []).map((p) => [p[1], p[2]])])),
};
function propsOf(place) { return place === 'map' ? MAP_PROPS : (ROOMS[place].props || []); }
function propBox(p) {
  const img = images['prop:' + p[0]];
  const h = img ? (p[3] * img.height) / img.width : p[3];
  return [p[1] - p[3] / 2, p[2] - h, p[3], h];
}
function propAt(place, x, y) {
  const list = propsOf(place);
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    const [bx, by, bw, bh] = propBox(list[i]);
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh && (best < 0 || list[i][2] > list[best][2])) best = i;   // the one in front wins
  }
  return best;
}
// After a prop moved: people walk around its new place, and the jukebox music follows the jukebox.
function propsMoved(place) {
  if (place === 'map') {
    mapPropSolids = propFootprints(MAP_PROPS);
    const jb = MAP_PROPS.find((p) => p[0] === 'jukebox');
    if (jb) MAP_FX.jukebox = [jb[1], jb[2]];
  }
  if (typeof invalidateNav === 'function') invalidateNav(place === 'map' ? 'town' : place);
}
function applySavedProps(saved) {
  if (!saved) return;
  const put = (list, pos) => (pos || []).forEach((q, i) => { if (list[i] && q && q[0] === list[i][0]) { list[i][1] = q[1]; list[i][2] = q[2]; } });
  put(MAP_PROPS, saved.map);
  for (const [id, pos] of Object.entries(saved.rooms || {})) if (ROOMS[id]) put(ROOMS[id].props || [], pos);
  propsMoved('map');
  for (const id of Object.keys(ROOMS)) propsMoved(id);
}

const editorPanel = document.getElementById('editor');
const editorStatus = document.getElementById('editor-status');
const brushInput = document.getElementById('brush');

function setEditing(on) {
  editor.on = on;
  editorPanel.hidden = !on;
  document.getElementById('edit').setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('editing', on);
  editor.tintDirty = true;
  if (on) setStatus(editor.changed.size ? 'Niet opgeslagen wijzigingen' : 'Schilder, en loop dan rond om het te proberen.');
}

function setTool(tool) {
  editor.tool = tool;
  if (tool.mode === 'props') setStatus('Sleep een prop naar een andere plek. Sla daarna op.');
  for (const b of editorPanel.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool.key));
  editor.tintDirty = true;
}

function setStatus(text) {
  editorStatus.textContent = text;
}

// ---------- painting ----------

function paintAt(x, y) {
  const L = layerFor(state.scene);
  const arr = L[editor.tool.layer];
  const cx = x / L.cell, cy = y / L.cell, r = editor.brush;
  for (let row = Math.floor(cy - r); row <= Math.ceil(cy + r); row++) {
    if (row < 0 || row >= L.rows) continue;
    for (let col = Math.floor(cx - r); col <= Math.ceil(cx + r); col++) {
      if (col < 0 || col >= L.cols) continue;
      if ((col + 0.5 - cx) ** 2 + (row + 0.5 - cy) ** 2 > r * r) continue;
      const i = row * L.cols + col;
      if (arr[i] === editor.tool.value) continue;
      const key = editor.tool.layer + ':' + i;
      if (!editor.stroke.has(key)) editor.stroke.set(key, arr[i]);
      arr[i] = editor.tool.value;
    }
  }
  editor.tintDirty = true;
}

function paintLine(from, to) {
  const L = layerFor(state.scene);
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(1, Math.ceil(d / (L.cell * 0.75)));
  for (let s = 1; s <= steps; s++) paintAt(from[0] + ((to[0] - from[0]) * s) / steps, from[1] + ((to[1] - from[1]) * s) / steps);
}

function endStroke() {
  if (!editor.stroke) return;
  if (editor.stroke.size) {
    const id = layerId(state.scene);
    editor.undo.push({ id, changes: editor.stroke });
    if (editor.undo.length > 100) editor.undo.shift();
    editor.changed.add(id);
    computeBaselines(layers[id]);
    if (typeof invalidateNav === 'function') invalidateNav(id);
    setStatus('Niet opgeslagen wijzigingen');
  }
  editor.stroke = null;
}

function undoLast() {
  const step = editor.undo.pop();
  if (!step) return;
  if (step.prop) {                               // a prop goes back where it was
    const p = propsOf(step.place)[step.index];
    [p[1], p[2]] = step.from;
    propsMoved(step.place);
    editor.propsChanged = true;
    setStatus('Ongedaan gemaakt. Niet opgeslagen wijzigingen');
    return;
  }
  const L = layers[step.id];
  for (const [key, old] of step.changes) {
    const [layer, i] = key.split(':');
    L[layer][Number(i)] = old;
  }
  computeBaselines(L);
  if (typeof invalidateNav === 'function') invalidateNav(step.id);
  editor.changed.add(step.id);
  editor.tintDirty = true;
  setStatus('Ongedaan gemaakt. Niet opgeslagen wijzigingen');
}

function resetPlace() {
  const defaults = state.scene === 'map' ? PROP_DEFAULTS.map : PROP_DEFAULTS.rooms[state.scene] || [];
  propsOf(state.scene).forEach((p, i) => { if (defaults[i]) [p[1], p[2]] = defaults[i]; });
  propsMoved(state.scene);
  editor.propsChanged = true;
  const id = layerId(state.scene);
  layers[id] = buildLayer(DEFAULT_MASKS[id]);
  if (typeof invalidateNav === 'function') invalidateNav(id);
  editor.undo = editor.undo.filter((s) => s.id !== id);
  editor.changed.add(id);
  editor.tintDirty = true;
  setStatus('Terug naar de eerste versie van deze plek. Sla op om dat te bewaren.');
}

// ---------- drawing the layers ----------

function rebuildTint() {
  const L = layerFor(state.scene);
  const view = editor.tool.layer;
  const c = editor.tint;
  c.width = L.cols;
  c.height = L.rows;
  const img = new ImageData(L.cols, L.rows);
  const d = img.data;
  for (let i = 0; i < L.cols * L.rows; i++) {
    let rgb = null, a = 0;
    if (view === 'walk') {
      if (L.walk[i]) { rgb = [60, 200, 90]; a = 70; } else { rgb = [230, 60, 50]; a = 115; }
    } else if (L.cover[i] === 1) { rgb = [70, 140, 255]; a = 140; }
    else if (L.cover[i] === 2) { rgb = [255, 200, 0]; a = 115; }
    if (!rgb) continue;
    d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = a;
  }
  c.getContext('2d').putImageData(img, 0, 0);
  editor.tintFor = state.scene + ':' + view;
  editor.tintDirty = false;
}

function drawEditor(g) {
  if (!editor.on) return;
  if (editor.tool.mode === 'props') {             // moving props: a frame around each one
    g.save();
    g.lineWidth = 2 / state.camera.zoom;
    const list = propsOf(state.scene);
    const hover = editor.mouse ? propAt(state.scene, editor.mouse[0], editor.mouse[1]) : -1;
    list.forEach((p, i) => {
      const [x, y, w, h] = propBox(p);
      const on = (editor.drag && editor.drag.index === i) || i === hover;
      g.strokeStyle = on ? 'rgba(255,220,120,0.95)' : 'rgba(200,130,255,0.75)';
      g.setLineDash(on ? [] : [6 / state.camera.zoom, 4 / state.camera.zoom]);
      g.strokeRect(x, y, w, h);
    });
    g.restore();
    return;
  }
  if (editor.tintDirty || editor.tintFor !== state.scene + ':' + editor.tool.layer) rebuildTint();
  const L = layerFor(state.scene);
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(editor.tint, 0, 0, L.cols * L.cell, L.rows * L.cell);
  // doors, for reference
  g.fillStyle = 'rgba(0,230,255,0.9)';
  const doors = state.scene === 'map' ? BUILDINGS.map((b) => b.door) : [ROOMS[state.scene].exit];
  for (const [x, y] of doors) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  // brush outline
  if (editor.mouse) {
    g.strokeStyle = `rgb(${editor.tool.color})`;
    g.lineWidth = 2 / state.camera.zoom;
    g.beginPath();
    g.arc(editor.mouse[0], editor.mouse[1], editor.brush * L.cell, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

// ---------- input ----------

canvas.addEventListener('pointerdown', (e) => {
  if (!editor.on) return;
  e.stopImmediatePropagation();
  canvas.setPointerCapture(e.pointerId);
  const pos = screenToWorld(e.offsetX, e.offsetY);
  if (e.button === 2 || e.button === 1 || e.shiftKey) {
    editor.panning = { sx: e.offsetX, sy: e.offsetY, cx: state.camera.x, cy: state.camera.y };
    state.cameraFree = true;
    return;
  }
  if (editor.tool.mode === 'props') {
    const i = propAt(state.scene, pos[0], pos[1]);
    if (i < 0) {                                  // not on a prop: look around instead
      editor.panning = { sx: e.offsetX, sy: e.offsetY, cx: state.camera.x, cy: state.camera.y };
      state.cameraFree = true;
      return;
    }
    const p = propsOf(state.scene)[i];
    editor.drag = { place: state.scene, index: i, from: [p[1], p[2]], dx: pos[0] - p[1], dy: pos[1] - p[2] };
    return;
  }
  editor.stroke = new Map();
  paintAt(pos[0], pos[1]);
  editor.lastPaint = pos;
}, true);

canvas.addEventListener('pointermove', (e) => {
  if (!editor.on) return;
  const pos = screenToWorld(e.offsetX, e.offsetY);
  editor.mouse = pos;
  if (editor.panning) {
    const p = editor.panning;
    state.camera.x = p.cx - (e.offsetX - p.sx) / state.camera.zoom;
    state.camera.y = p.cy - (e.offsetY - p.sy) / state.camera.zoom;
  } else if (editor.drag) {
    const d = editor.drag, p = propsOf(d.place)[d.index];
    p[1] = Math.round(pos[0] - d.dx);
    p[2] = Math.round(pos[1] - d.dy);
  } else if (editor.stroke) {
    paintLine(editor.lastPaint, pos);
    editor.lastPaint = pos;
  }
});

function endPointer() {
  editor.panning = null;
  if (editor.drag) {
    const d = editor.drag, p = propsOf(d.place)[d.index];
    editor.drag = null;
    if (p[1] !== d.from[0] || p[2] !== d.from[1]) {
      editor.undo.push({ prop: true, place: d.place, index: d.index, from: d.from });
      editor.propsChanged = true;
      propsMoved(d.place);
      setStatus('Niet opgeslagen wijzigingen');
    }
  }
  endStroke();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { editor.mouse = null; });
canvas.addEventListener('contextmenu', (e) => { if (editor.on) e.preventDefault(); });

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'e' && !e.ctrlKey && !e.metaKey) { setEditing(!editor.on); return; }
  if (!editor.on) return;
  const tool = TOOLS.find((t) => t.key === e.key);
  if (tool) setTool(tool);
  if (e.key === '[') setBrush(editor.brush - 1);
  if (e.key === ']') setBrush(editor.brush + 1);
  if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoLast(); }
});

function setBrush(r) {
  editor.brush = Math.max(1, Math.min(16, r));
  brushInput.value = editor.brush;
}

// ---------- toolbar ----------

for (const t of TOOLS) {
  const b = document.createElement('button');
  b.dataset.tool = t.key;
  b.title = (t.hint ? t.hint + ' · ' : '') + 'toets ' + t.key;
  b.innerHTML = `<span class="swatch" style="background: rgb(${t.color})"></span>${t.label}`;
  b.addEventListener('click', () => setTool(t));
  document.getElementById('tools').appendChild(b);
}
setTool(TOOLS[0]);
brushInput.addEventListener('input', () => setBrush(Number(brushInput.value)));
document.getElementById('edit').addEventListener('click', () => setEditing(!editor.on));
document.getElementById('undo').addEventListener('click', undoLast);
document.getElementById('reset-place').addEventListener('click', resetPlace);
document.getElementById('done').addEventListener('click', () => setEditing(false));
document.getElementById('save').addEventListener('click', saveChanges);

// ---------- saving ----------

let dbReady = null;
function getDb() {
  if (!dbReady) dbReady = window.claude && window.claude.use ? window.claude.use('db').catch(() => null) : Promise.resolve(null);
  return dbReady;
}

async function saveChanges() {
  if (!editor.changed.size && !editor.propsChanged) { setStatus('Niets nieuws om op te slaan.'); return; }
  const db = await getDb();
  if (!db) { setStatus('Opslaan werkt alleen op de claude.ai-pagina.'); return; }
  setStatus('Opslaan…');
  try {
    if (editor.propsChanged) {
      await db.doc('settings/props').set({
        map: MAP_PROPS.map((p) => [p[0], p[1], p[2]]),
        rooms: Object.fromEntries(Object.entries(ROOMS).map(([id, r]) => [id, (r.props || []).map((p) => [p[0], p[1], p[2]])])),
        savedAt: new Date().toISOString(),
      });
      editor.propsChanged = false;
    }
    for (const id of [...editor.changed]) {
      const L = layers[id];
      await db.doc('masks/' + id).set({
        cols: L.cols, rows: L.rows, cell: L.cell,
        walk: encodeLayer(L.walk), cover: encodeLayer(L.cover), savedAt: new Date().toISOString(),
      });
      editor.changed.delete(id);
    }
    setStatus('Opgeslagen ✓');
  } catch (err) {
    setStatus(err && err.code === 'invalid_argument' ? 'Deze pagina kan niet voor je opslaan.' : 'Opslaan lukte nu niet. Probeer het zo nog eens.');
  }
}

// Load corrections saved earlier, on top of the first version.
getDb().then(async (db) => {
  if (!db) return;
  for (const id of Object.keys(layers)) {
    try {
      const snap = await db.doc('masks/' + id).get();
      const data = snap.exists && snap.data();
      if (!data || data.cols !== layers[id].cols || data.rows !== layers[id].rows) continue;
      if (typeof MASKS_MADE === 'string' && (!data.savedAt || data.savedAt < MASKS_MADE)) continue;   // painted on the old version
      layers[id] = buildLayer({ ...data, cell: layers[id].cell });
      if (typeof invalidateNav === 'function') invalidateNav(id);
      editor.tintDirty = true;
    } catch (err) { /* keep the first version */ }
  }
});

// ---------- size of the figures (Harm, 2026-11-01) ----------
// Two sliders: in town and indoors. Saved straight away (this browser at once, the page's storage on claude.ai).

const sizeInputs = { town: document.getElementById('size-town'), room: document.getElementById('size-room') };
function showSize(which) {
  sizeInputs[which].value = FIGURE[which];
  document.getElementById('size-' + which + '-val').textContent = String(FIGURE[which]).replace('.', ',') + '×';
}
let sizeSave = null;
function setSize(which, v) {
  FIGURE[which] = Math.max(0.5, Math.min(4, Number(v) || 1));
  showSize(which);
  try { localStorage.setItem('village-figure', JSON.stringify(FIGURE)); } catch (e) { /* fine */ }
  clearTimeout(sizeSave);
  sizeSave = setTimeout(async () => {
    const db = await getDb();
    if (db) db.doc('settings/figure').set({ town: FIGURE.town, room: FIGURE.room, savedAt: new Date().toISOString() }).catch(() => {});
  }, 800);
}
for (const which of ['town', 'room']) sizeInputs[which].addEventListener('input', () => setSize(which, sizeInputs[which].value));
try { const s = JSON.parse(localStorage.getItem('village-figure') || 'null'); if (s) { if (s.town) FIGURE.town = s.town; if (s.room) FIGURE.room = s.room; } } catch (e) { /* fine */ }
showSize('town'); showSize('room');
getDb().then(async (db) => {
  if (!db) return;
  try {
    const f = await db.doc('settings/figure').get();
    if (f.exists) { const d = f.data(); if (d.town) FIGURE.town = d.town; if (d.room) FIGURE.room = d.room; showSize('town'); showSize('room'); }
  } catch (e) { /* keep */ }
  try {
    const pr = await db.doc('settings/props').get();
    if (pr.exists) applySavedProps(pr.data());
  } catch (e) { /* keep the first places */ }
});
