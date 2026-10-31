// Paint mode (key E): correct where the character may walk and what he goes under or behind.
// Corrections are saved into the page's own storage on claude.ai, where Claude can read them.

const TOOLS = [
  { key: '1', label: 'Begaanbaar', layer: 'walk', value: 1, color: '60,200,90' },
  { key: '2', label: 'Geblokkeerd', layer: 'walk', value: 0, color: '230,60,50' },
  { key: '3', label: 'Eronder', hint: 'altijd boven hem: boomkruinen, daken', layer: 'cover', value: 1, color: '70,140,255' },
  { key: '4', label: 'Erachter', hint: 'boven hem als hij erachter loopt', layer: 'cover', value: 2, color: '255,200,0' },
  { key: '5', label: 'Geen dekking', layer: 'cover', value: 0, color: '255,255,255' },
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
};

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
  const L = layers[step.id];
  for (const [key, old] of step.changes) {
    const [layer, i] = key.split(':');
    L[layer][Number(i)] = old;
  }
  computeBaselines(L);
  if (typeof invalidateNav === 'function') invalidateNav(step.id);
  editor.changed.add(step.id);
  editor.tintDirty = true;
  setStatus('Undone. Unsaved changes');
}

function resetPlace() {
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
  } else if (editor.stroke) {
    paintLine(editor.lastPaint, pos);
    editor.lastPaint = pos;
  }
});

function endPointer() {
  editor.panning = null;
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
  b.title = (t.hint ? t.hint + ' · ' : '') + 'key ' + t.key;
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
  if (!editor.changed.size) { setStatus('Niets nieuws om op te slaan.'); return; }
  const db = await getDb();
  if (!db) { setStatus('Opslaan werkt alleen op de claude.ai-pagina.'); return; }
  setStatus('Saving…');
  try {
    for (const id of [...editor.changed]) {
      const L = layers[id];
      await db.doc('masks/' + id).set({
        cols: L.cols, rows: L.rows, cell: L.cell,
        walk: encodeLayer(L.walk), cover: encodeLayer(L.cover), savedAt: new Date().toISOString(),
      });
      editor.changed.delete(id);
    }
    setStatus('Saved ✓ Tell Claude, and the changes go into the project.');
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
