// Finding the way: a coarse walking grid for every place, built from the walk layer (game/masks.js plus any
// paint-mode corrections) and the props, with room for a body so nobody brushes through walls or furniture.
// findPath() returns a smoothed list of points that stays on walkable ground (A* on 8-unit cells).

const NAV_CELL = 8;
const navCache = {};

function navPlaceId(where) { return where === 'map' ? 'town' : where; }
// The walking grid keeps the first body size: feet take the same room on the paths, so no route gets cut off
// however big people are drawn (FIGURE, the sliders in Kaart bewerken).
function navHeight(where) { return where === 'map' ? 92 : ROOM_H / 6; }

function invalidateNav(id) { delete navCache[id]; }

function buildNav(where) {
  const id = navPlaceId(where);
  const L = layers[id];
  const [w, h] = where === 'map' ? [MAP.w, MAP.h] : [ROOM_W, ROOM_H];
  const cols = Math.ceil(w / NAV_CELL), rows = Math.ceil(h / NAV_CELL);
  const ok = new Uint8Array(cols * rows);
  const props = propFootprints(where === 'map' ? MAP_PROPS : (ROOMS[where].props || []));
  const r = navHeight(where) * 0.07;                    // about half the width of a pair of feet
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * NAV_CELL + NAV_CELL / 2, y = row * NAV_CELL + NAV_CELL / 2;
      let good = true;
      for (const [dx, dy] of [[0, 0], [-r, 0], [r, 0], [0, -r * 0.5], [0, r * 0.5], [-r, -r * 0.5], [r, -r * 0.5], [-r, r * 0.5], [r, r * 0.5]]) {
        if (!isWalkable(L, x + dx, y + dy)) { good = false; break; }
      }
      if (good && hitsObstacle(x, y, props)) good = false;
      ok[row * cols + col] = good ? 1 : 0;
    }
  }
  // keep only the ground that connects to the main area (no islands to get stuck on)
  const seed = where === 'map' ? [1200, 1010] : (ROOMS[where].start || [ROOMS[where].exit[0], ROOMS[where].exit[1] - 70]);
  const main = new Uint8Array(cols * rows);
  const start = nearestOpen({ cols, rows, ok }, seed[0], seed[1]);
  if (start >= 0) {
    const q = [start]; main[start] = 1;
    while (q.length) {
      const i = q.pop(), c = i % cols, rr = (i / cols) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = c + dc, nr = rr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (dc && dr && (!ok[rr * cols + nc] || !ok[nr * cols + c])) continue;   // same rule as walking: no cutting corners
        if (ok[j] && !main[j]) { main[j] = 1; q.push(j); }
      }
    }
  }
  const open = [];
  for (let i = 0; i < main.length; i++) if (main[i]) open.push(i);
  navCache[navPlaceId(where)] = { where, cols, rows, ok: main, open };
  return navCache[navPlaceId(where)];
}

function navFor(where) {
  return navCache[navPlaceId(where)] || buildNav(where);
}

function navIndex(N, x, y) {
  const c = Math.floor(x / NAV_CELL), r = Math.floor(y / NAV_CELL);
  if (c < 0 || r < 0 || c >= N.cols || r >= N.rows) return -1;
  return r * N.cols + c;
}
function navCenter(N, i) {
  return [(i % N.cols) * NAV_CELL + NAV_CELL / 2, ((i / N.cols) | 0) * NAV_CELL + NAV_CELL / 2];
}
function navOpenAt(where, x, y) {
  const N = navFor(where), i = navIndex(N, x, y);
  return i >= 0 && N.ok[i] === 1;
}

// The open cell closest to (x, y), searching outward ring by ring.
function nearestOpen(N, x, y, maxRing = 40) {
  const c0 = Math.floor(x / NAV_CELL), r0 = Math.floor(y / NAV_CELL);
  for (let ring = 0; ring <= maxRing; ring++) {
    let best = -1, bestD = Infinity;
    for (let r = r0 - ring; r <= r0 + ring; r++) {
      for (let c = c0 - ring; c <= c0 + ring; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== ring) continue;
        if (c < 0 || r < 0 || c >= N.cols || r >= N.rows) continue;
        const i = r * N.cols + c;
        if (!N.ok[i]) continue;
        const [cx, cy] = navCenter(N, i), d = Math.hypot(cx - x, cy - y);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}
function nearestOpenPoint(where, x, y) {
  const N = navFor(where), i = nearestOpen(N, x, y);
  return i < 0 ? null : navCenter(N, i);
}

// Straight line between two points stays on open cells.
function navLineClear(N, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(d / 1.5));   // fine steps: no clipping a corner
  for (let s = 0; s <= steps; s++) {
    const i = navIndex(N, x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
    if (i < 0 || !N.ok[i]) return false;
  }
  return true;
}

// A* from one point to another in the same place. `avoid` is a list of [x, y, radius] to steer around (people standing still).
function findPath(where, from, to, avoid = []) {
  const N = navFor(where);
  const s = nearestOpen(N, from[0], from[1]), g = nearestOpen(N, to[0], to[1]);
  if (s < 0 || g < 0) return null;
  const blocked = new Set();
  for (const [ax, ay, ar] of avoid) {
    const c0 = Math.floor((ax - ar) / NAV_CELL), c1 = Math.floor((ax + ar) / NAV_CELL);
    const r0 = Math.floor((ay - ar * 0.6) / NAV_CELL), r1 = Math.floor((ay + ar * 0.6) / NAV_CELL);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * N.cols + c;
      if (i !== s && i !== g && c >= 0 && r >= 0 && c < N.cols && r < N.rows) blocked.add(i);
    }
  }
  const cols = N.cols, n = N.ok.length;
  const gScore = new Float32Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const gx = g % cols, gy = (g / cols) | 0;
  const h = (i) => { const dx = Math.abs((i % cols) - gx), dy = Math.abs(((i / cols) | 0) - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const heap = [[h(s), s]];
  gScore[s] = 0;
  const push = (item) => { heap.push(item); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = false, guard = 0;
  while (heap.length && guard++ < 200000) {
    const [, i] = pop();
    if (closed[i]) continue;
    if (i === g) { found = true; break; }
    closed[i] = 1;
    const c = i % cols, r = (i / cols) | 0;
    for (const [dc, dr, cost] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= N.rows) continue;
      const j = nr * cols + nc;
      if (!N.ok[j] || closed[j] || blocked.has(j)) continue;
      if (dc && dr && (!N.ok[r * cols + nc] || !N.ok[nr * cols + c])) continue;   // no cutting corners
      const ng = gScore[i] + cost;
      if (ng < gScore[j]) { gScore[j] = ng; came[j] = i; push([ng + h(j), j]); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = g; i !== -1; i = came[i]) cells.push(i);
  cells.reverse();
  // string-pulling: keep only the turns needed to stay on open ground
  const pts = cells.map((i) => navCenter(N, i));
  const out = [[from[0], from[1]]];
  // from where they actually stand: head straight for the farthest point they can reach in a line
  let a = 0;
  for (let b = pts.length - 1; b > 0; b--) {
    if (navLineClear(N, from[0], from[1], pts[b][0], pts[b][1])) { a = b; break; }
  }
  out.push(pts[a]);
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !navLineClear(N, pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b--;
    out.push(pts[b]);
    a = b;
  }
  const endOpen = navOpenAt(where, to[0], to[1]);
  if (endOpen) out.push([to[0], to[1]]);
  return out;
}

// A random open spot, optionally inside a box [x, y, w, h].
function randomOpenSpot(where, box) {
  const N = navFor(where);
  for (let tries = 0; tries < 60; tries++) {
    let i;
    if (box) {
      const x = box[0] + Math.random() * box[2], y = box[1] + Math.random() * box[3];
      i = navIndex(N, x, y);
      if (i < 0 || !N.ok[i]) continue;
    } else {
      i = N.open[(Math.random() * N.open.length) | 0];
    }
    return navCenter(N, i);
  }
  return null;
}
