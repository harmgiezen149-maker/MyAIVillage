// The invisible layers on top of the art, one set per place:
//   walk  — where the character may stand (1) or not (0)
//   cover — 0 nothing, 1 "under": always drawn over him, 2 "behind": drawn over him only while
//           his feet are above the bottom edge of that patch (so he walks in front of it below the line)
// The first version comes from game/masks.js; corrections painted in edit mode are saved separately.

const layers = {};

function decodeLayer(text, length) {
  const out = new Uint8Array(length);
  let i = 0;
  for (const [, value, run] of text.matchAll(/([A-Z])([0-9a-z]+)/g)) {
    const n = parseInt(run, 36);
    out.fill(value.charCodeAt(0) - 65, i, i + n);
    i += n;
  }
  return out;
}

function encodeLayer(arr) {
  let out = '', i = 0;
  while (i < arr.length) {
    let j = i;
    while (j < arr.length && arr[j] === arr[i]) j++;
    out += String.fromCharCode(65 + arr[i]) + (j - i).toString(36);
    i = j;
  }
  return out;
}

function buildLayer(src) {
  const n = src.cols * src.rows;
  const L = {
    cell: src.cell, cols: src.cols, rows: src.rows,
    walk: decodeLayer(src.walk, n), cover: decodeLayer(src.cover, n), base: new Float32Array(n),
  };
  computeBaselines(L);
  return L;
}

// For every cover cell: the bottom edge of the unbroken run of cover it belongs to, column by column.
function computeBaselines(L) {
  const { cols, rows, cover, base, cell } = L;
  for (let c = 0; c < cols; c++) {
    let bottom = 0;
    for (let r = rows - 1; r >= 0; r--) {
      const i = r * cols + c;
      if (cover[i]) {
        if (r === rows - 1 || !cover[i + cols]) bottom = (r + 1) * cell;
        base[i] = bottom;
      } else base[i] = 0;
    }
  }
}

for (const [id, src] of Object.entries(DEFAULT_MASKS)) layers[id] = buildLayer(src);

function layerId(scene) {
  return scene === 'map' ? 'town' : scene;
}
function layerFor(scene) {
  return layers[layerId(scene)];
}

function isWalkable(L, x, y) {
  const c = Math.floor(x / L.cell), r = Math.floor(y / L.cell);
  if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) return false;
  return L.walk[r * L.cols + c] === 1;
}

function coversAt(L, i, feetY) {
  const v = L.cover[i];
  return v === 1 || (v === 2 && L.base[i] > feetY);
}

// Draws a figure with the parts that are under or behind something cut away,
// so the art shows through there. `bbox` is the figure's box in world units.
const figureCanvas = document.createElement('canvas');
const figureCtx = figureCanvas.getContext('2d');
const holeCanvas = document.createElement('canvas');
const holeCtx = holeCanvas.getContext('2d');

function drawWithCover(g, L, bbox, feetY, drawFigure) {
  const { cell, cols, rows } = L;
  const c0 = Math.floor(bbox.x / cell) - 1, c1 = Math.floor((bbox.x + bbox.w) / cell) + 1;
  const r0 = Math.floor(bbox.y / cell) - 1, r1 = Math.floor((bbox.y + bbox.h) / cell) + 1;
  const mw = c1 - c0 + 1, mh = r1 - r0 + 1;
  const holes = new ImageData(mw, mh);
  let any = false;
  for (let r = r0; r <= r1; r++) {
    if (r < 0 || r >= rows) continue;
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= cols) continue;
      if (coversAt(L, r * cols + c, feetY)) {
        holes.data[((r - r0) * mw + (c - c0)) * 4 + 3] = 255;
        any = true;
      }
    }
  }
  if (!any) { drawFigure(g); return; }

  const m = g.getTransform();
  const scale = Math.hypot(m.a, m.b);
  const pw = Math.max(1, Math.ceil(bbox.w * scale)), ph = Math.max(1, Math.ceil(bbox.h * scale));
  if (figureCanvas.width < pw) figureCanvas.width = pw;
  if (figureCanvas.height < ph) figureCanvas.height = ph;
  figureCtx.setTransform(1, 0, 0, 1, 0, 0);
  figureCtx.clearRect(0, 0, figureCanvas.width, figureCanvas.height);
  figureCtx.setTransform(scale, 0, 0, scale, -bbox.x * scale, -bbox.y * scale);
  drawFigure(figureCtx);

  holeCanvas.width = mw;
  holeCanvas.height = mh;
  holeCtx.putImageData(holes, 0, 0);
  figureCtx.globalCompositeOperation = 'destination-out';
  figureCtx.imageSmoothingEnabled = true;    // soft edges where he goes under
  figureCtx.drawImage(holeCanvas, c0 * cell, r0 * cell, mw * cell, mh * cell);
  figureCtx.globalCompositeOperation = 'source-over';

  g.drawImage(figureCanvas, 0, 0, pw, ph, bbox.x, bbox.y, pw / scale, ph / scale);
}
