// My AI Village — the town, the rooms, the moving effects and the walking CEO.

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const audio = new VillageAudio();

// ---------- loading ----------

const images = {};
function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images[key] = img; resolve(); };
    img.onerror = () => { console.warn('Missing image', src); resolve(); };
    img.src = src;
  });
}

const propNames = new Set([...MAP_PROPS.map((p) => p[0]), ...Object.values(ROOMS).flatMap((r) => (r.props || []).map((p) => p[0]))]);
const loading = Promise.all([
  loadImage('map', MAP.image),
  loadImage(WALK_SHEET.image, WALK_SHEET.src),
  loadImage(KEVIN_SHEET.image, KEVIN_SHEET.src),
  loadImage(KEVIN_PHONE_SHEET.image, KEVIN_PHONE_SHEET.src),
  ...Object.keys(ROOMS).map((id) => loadImage('room:' + id, `assets/rooms/${id}.jpg`)),
  ...[...propNames].map((n) => loadImage('prop:' + n, `assets/props/${n}.png`)),
]);

// ---------- state ----------

const ROOM_W = 1200, ROOM_H = 896;
const state = {
  scene: 'map',        // 'map' or a room id
  building: null,
  player: { x: START[0], y: START[1], facing: 1, dir: 'down', step: 0, moving: false },
  kevin: { x: START[0] - 40, y: START[1] - 30, dir: 'down', step: 0, moving: false, callUntil: 0 },
  trail: [],
  target: null,
  camera: { x: START[0], y: START[1], zoom: 1 },
  zoomFactor: { map: 1.8, room: 1 },
  zoomDefault: { map: 1.8 },
  doorArmed: true,
  fade: 0,
  time: 0,
};
const keys = new Set();

function sceneSize() {
  return state.scene === 'map' ? [MAP.w, MAP.h] : [ROOM_W, ROOM_H];
}
function fitZoom() {
  const [w, h] = sceneSize();
  const contain = Math.min(canvas.clientWidth / w, canvas.clientHeight / h);
  const cover = Math.max(canvas.clientWidth / w, canvas.clientHeight / h);
  // On a tall phone screen "contain" leaves the town a thin strip: then start closer, so it fills the screen
  // (with the default zoom it exactly covers it) and the camera follows Harm. On a wide screen nothing changes.
  return Math.max(contain, cover / (state.scene === 'map' ? state.zoomDefault.map : 1.6));
}
function personHeight() {
  return state.scene === 'map' ? 92 * FIGURE.town : (ROOM_H / 6) * FIGURE.room;    // drawn size: Harm's sliders in Kaart bewerken
}

// ---------- where he can stand ----------

function hitsObstacle(x, y, list) {
  return list.some((o) => x > o[0] && x < o[0] + o[2] && y > o[1] && y < o[1] + o[3]);
}
function propFootprints(props) {
  return props.filter((p) => p[4] !== false).map(([name, x, y, w]) => [x - w * 0.42, y - w * 0.3, w * 0.84, w * 0.32]);
}
let mapPropSolids = propFootprints(MAP_PROPS);     // recomputed when Harm moves a prop (Kaart bewerken)

function canStand(x, y) {
  if (!isWalkable(layerFor(state.scene), x, y)) return false;
  const solids = state.scene === 'map' ? mapPropSolids : propFootprints(ROOMS[state.scene].props || []);
  return !hitsObstacle(x, y, solids);
}

// ---------- scenes ----------

function enterBuilding(b) {
  if (!b.room) {
    toast(`${b.name} — ${b.job}. Hier woont nog niemand.`);
    state.doorArmed = false;
    return;
  }
  transition(() => {
    state.scene = b.room;
    state.building = b;
    const [ex, ey] = ROOMS[b.room].exit;
    [state.player.x, state.player.y] = ROOMS[b.room].start || [ex, ey - 70];
    placeKevinBehind(0, 1);
    state.target = null;
    state.camera.zoom = fitZoom() * state.zoomFactor.room;
    state.camera.x = ROOM_W / 2;
    state.camera.y = ROOM_H / 2;
    audio.setIndoors(true);
    setPlace(b.name, b.job);
  });
}

function leaveBuilding() {
  const b = state.building;
  transition(() => {
    state.scene = 'map';
    state.building = null;
    state.player.x = b.door[0];
    state.player.y = b.door[1] + 46;
    placeKevinBehind(0, -1);
    state.target = null;
    state.doorArmed = false;
    state.camera.zoom = fitZoom() * state.zoomFactor.map;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    audio.setIndoors(false);
    setPlace('Mijn AI-dorp', 'Dorpsplein');
  });
}

// The way to where Harm clicked: along open ground, around walls, furniture and people standing still.
// Clicking at (or near) a door walks in through it; indoors, clicking at the exit walks out.
function planPlayerRoute(again) {
  const p = state.player, where = state.scene;
  state.routeFor = state.target;
  if (!again) state.routeTries = 0;
  let goal = state.target.slice(), finish = null;
  if (where === 'map') {
    const b = BUILDINGS.find((x) => Math.hypot(goal[0] - x.door[0], goal[1] - x.door[1]) < 45);
    if (b) { goal = [b.door[0], b.door[1] + 30]; finish = b.door.slice(); if (!again) state.doorArmed = true; }   // a click on the door means: go in
  } else {
    const [ex, ey] = ROOMS[where].exit;
    if (Math.hypot(goal[0] - ex, goal[1] - ey) < 90) { goal = [ex, ey - 24]; finish = [ex, ey + 14]; }
  }
  const H = personHeight();
  const avoid = typeof residents === 'undefined' ? [] : residents
    .filter((r) => r.where === where && !r.moving && Math.hypot(r.x - goal[0], r.y - goal[1]) > H * 0.5)
    .map((r) => [r.x, r.y, H * 0.3]);
  let path = typeof findPath === 'function' ? findPath(where, [p.x, p.y], goal, avoid) : null;
  if (!path && avoid.length) path = findPath(where, [p.x, p.y], goal);
  state.route = path ? path.slice(1) : [goal];
  if (finish) state.route.push(finish);
  state.routeStuck = 0;
}

function transition(swap) {
  state.fade = 1;
  state.cameraFree = false;
  setTimeout(swap, 180);
}

// ---------- update ----------

function update(dt) {
  state.time += dt;
  const p = state.player;
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
  if (dx || dy) { state.target = null; state.cameraFree = false; }
  if (state.meeting) state.target = null;                       // seated at the head of the table
  // Click or tap: first a route along the paths (game/nav.js), then follow it point by point (Harm, 2026-11-01).
  if (!state.target) state.route = null;
  else if (state.routeFor !== state.target) planPlayerRoute();
  let stepCap = Infinity;
  if (state.route) {
    while (state.route.length && Math.hypot(state.route[0][0] - p.x, state.route[0][1] - p.y) < 3) state.route.shift();
    if (!state.route.length) { state.target = null; state.route = null; }
    else {
      const tx = state.route[0][0] - p.x, ty = state.route[0][1] - p.y, d = Math.hypot(tx, ty);
      dx = tx / d; dy = ty / d; stepCap = d;                    // never overshoot a turn
    }
  }
  const speed = Math.min(stepCap, (state.scene === 'map' ? 190 : 230) * dt);
  p.moving = false;
  const before = [p.x, p.y];
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const mx = (dx / len) * speed, my = (dy / len) * speed;
    if (canStand(p.x + mx, p.y + my)) { p.x += mx; p.y += my; p.moving = true; }
    else if (canStand(p.x + mx, p.y)) { p.x += mx; p.moving = true; }
    else if (canStand(p.x, p.y + my)) { p.y += my; p.moving = true; }
    else if (!state.route) state.target = null;
    // following a route but not getting anywhere: work out the way again from here (a couple of times at most)
    if (state.route) {
      const moved = Math.hypot(p.x - before[0], p.y - before[1]);
      state.routeStuck = moved < speed * 0.3 ? (state.routeStuck || 0) + dt : 0;
      if (state.routeStuck > 0.4) {
        state.routeStuck = 0;
        if ((state.routeTries = (state.routeTries || 0) + 1) > 3) { state.target = null; state.route = null; }
        else planPlayerRoute(true);
      }
    }
    if (Math.abs(dx) > 0.2) p.facing = dx > 0 ? 1 : -1;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  const walked = Math.hypot(p.x - before[0], p.y - before[1]);
  p.phase = (p.phase || 0) + walked / (personHeight() * 0.2);
  if (!state.meeting) updateKevin(dt);                       // Kevin sits next to Harm in a meeting
  if (typeof updateResidents === 'function') updateResidents(dt);   // everyone else keeps walking (to the meeting, too)

  // doors
  if (state.fade <= 0 && !state.meeting) {
    if (state.scene === 'map') {
      let near = null;
      for (const b of BUILDINGS) if (Math.hypot(p.x - b.door[0], p.y - b.door[1]) < 26) near = b;
      if (near && state.doorArmed) enterBuilding(near);
      if (!near) state.doorArmed = true;
      audio.setJukeboxDistance(Math.hypot(p.x - MAP_FX.jukebox[0], p.y - MAP_FX.jukebox[1]));
      audio.setFountainDistance(Math.hypot(p.x - 1200, p.y - 860));   // the fountain in the square
    } else {
      const [ex, ey] = ROOMS[state.scene].exit;
      if (Math.abs(p.x - ex) < 55 && p.y > ey) leaveBuilding();
      audio.setJukeboxDistance(9999);
    }
  }
  state.fade = Math.max(0, state.fade - dt * 3);

  // camera follows the CEO in town; rooms sit centered
  const cam = state.camera;
  const [w, h] = sceneSize();
  if (state.cameraFree) { updateParticles(dt); return; }
  const viewW = canvas.clientWidth / cam.zoom, viewH = canvas.clientHeight / cam.zoom;
  let cx = state.scene === 'map' ? p.x : cam.x, cy = state.scene === 'map' ? p.y : cam.y;
  if (state.scene !== 'map' && (cam.zoom > fitZoom() * 1.05 || viewW < w * 0.98 || viewH < h * 0.98)) { cx = p.x; cy = p.y; }
  cx = viewW >= w ? w / 2 : Math.min(Math.max(cx, viewW / 2), w - viewW / 2);
  cy = viewH >= h ? h / 2 : Math.min(Math.max(cy, viewH / 2), h - viewH / 2);
  cam.x += (cx - cam.x) * Math.min(1, dt * 6);
  cam.y += (cy - cam.y) * Math.min(1, dt * 6);

  updateParticles(dt);
}

// ---------- effects ----------

const smoke = [];
const leaves = [];
let smokeClock = 0;

function updateParticles(dt) {
  smokeClock += dt;
  if (state.scene === 'map' && smokeClock > 0.22) {
    smokeClock = 0;
    for (const [x, y] of MAP_FX.smoke) {
      smoke.push({ x: x + (Math.random() - 0.5) * 6, y, vx: 6 + Math.random() * 8, vy: -16 - Math.random() * 10, r: 5 + Math.random() * 3, life: 0, max: 4 + Math.random() * 2 });
    }
  }
  for (const s of smoke) {
    s.life += dt;
    s.x += (s.vx + Math.sin(state.time * 1.3 + s.y * 0.05) * 6) * dt;
    s.y += s.vy * dt;
    s.r += dt * 6;
  }
  for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].life > smoke[i].max || state.scene !== 'map') smoke.splice(i, 1);

  if (state.scene === 'map' && leaves.length < 7 && Math.random() < dt * 0.6) {
    const cam = state.camera;
    const viewW = canvas.clientWidth / cam.zoom, viewH = canvas.clientHeight / cam.zoom;
    leaves.push({
      x: cam.x - viewW / 2 - 20, y: cam.y - viewH / 2 + Math.random() * viewH * 0.8,
      vx: 45 + Math.random() * 35, vy: 8 + Math.random() * 12, spin: Math.random() * 6, phase: Math.random() * 6,
      size: 5 + Math.random() * 3, hue: ['#c98a2b', '#d9a441', '#a8722c', '#8fae3c'][Math.floor(Math.random() * 4)],
    });
  }
  for (const l of leaves) {
    l.x += l.vx * dt;
    l.y += (l.vy + Math.sin(state.time * 2 + l.phase) * 18) * dt;
    l.spin += dt * 3;
  }
  const cam = state.camera;
  const farRight = cam.x + canvas.clientWidth / cam.zoom / 2 + 40;
  for (let i = leaves.length - 1; i >= 0; i--) if (leaves[i].x > farRight || state.scene !== 'map') leaves.splice(i, 1);
}

function flicker(seed, speed = 1) {
  const t = state.time * speed;
  return 0.75 + 0.15 * Math.sin(t * 7.1 + seed) + 0.1 * Math.sin(t * 13.7 + seed * 2.3);
}

function drawGlow(x, y, r, color = '255,200,110', strength = 0.55) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${strength})`);
  g.addColorStop(0.4, `rgba(${color},${strength * 0.35})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawFire({ x, y, size }, seed = 0) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(x, y - size * 0.4, size * 2.6 * flicker(seed, 1.3), '255,150,60', 0.35);
  for (let i = 0; i < 5; i++) {
    const t = state.time * (5 + i) + seed + i * 1.7;
    const fx = x + (i - 2) * size * 0.22 + Math.sin(t) * size * 0.06;
    const h = size * (0.9 + 0.35 * Math.sin(t * 1.3)) * (i === 2 ? 1.25 : 0.85);
    const w = size * 0.28;
    const grad = ctx.createLinearGradient(fx, y, fx, y - h);
    grad.addColorStop(0, 'rgba(255,240,170,0.95)');
    grad.addColorStop(0.45, 'rgba(255,150,40,0.8)');
    grad.addColorStop(1, 'rgba(220,60,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(fx - w, y);
    ctx.quadraticCurveTo(fx - w * 1.1, y - h * 0.5, fx + Math.sin(t * 1.7) * w * 0.6, y - h);
    ctx.quadraticCurveTo(fx + w * 1.1, y - h * 0.5, fx + w, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawOrb({ x, y, r }, seed = 0) {
  const pulse = 0.8 + 0.2 * Math.sin(state.time * 2.2 + seed) + 0.08 * Math.sin(state.time * 17 + seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(x, y, r * 3.2 * pulse, '120,220,255', 0.45);
  ctx.strokeStyle = `rgba(200,250,255,${0.35 * pulse})`;
  ctx.lineWidth = r * 0.08;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.6, r * 0.25, state.time * (1.4 + i) + i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFountain() {
  const f = MAP_FX.fountain;
  const t = state.time;
  ctx.save();
  // ripples in the basin and the bowl
  for (const [cx, cy, rx, ry] of [f.basin, f.bowl]) {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.35 + i / 3) % 1;
      ctx.strokeStyle = `rgba(235,250,255,${0.45 * (1 - k)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * (0.35 + 0.6 * k), ry * (0.35 + 0.6 * k), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // falling streams
  ctx.lineCap = 'round';
  for (const sx of f.streams) {
    const top = f.bowl[1] + 4, bottom = f.basin[1] + 12;
    for (let i = 0; i < 4; i++) {
      const k = (t * 1.6 + i / 4 + sx * 0.01) % 1;
      const y1 = top + (bottom - top) * k;
      ctx.strokeStyle = `rgba(240,252,255,${0.7 * (1 - k * 0.6)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + (sx - 1200) * 0.04 * k, y1);
      ctx.lineTo(sx + (sx - 1200) * 0.04 * (k + 0.06), y1 + 7);
      ctx.stroke();
    }
  }
  // spout splash and sparkles
  const [sx, sy] = f.top;
  for (let i = 0; i < 6; i++) {
    const k = (t * 1.2 + i / 6) % 1;
    const ang = (i / 6) * Math.PI * 2 + t * 0.3;
    ctx.fillStyle = `rgba(245,253,255,${0.8 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(sx + Math.cos(ang) * 14 * k, sy - 6 + 22 * k * k - 10 * k + Math.sin(ang) * 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.sin(t * 3 + i * 2.1);
    if (a < 0.6) continue;
    const ang = i * 0.785;
    ctx.fillStyle = `rgba(255,255,255,${(a - 0.6) * 2})`;
    ctx.beginPath();
    ctx.arc(f.basin[0] + Math.cos(ang) * f.basin[2] * 0.7, f.basin[1] + Math.sin(ang) * f.basin[3] * 0.7, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Re-draw a strip of the map art with a gentle wave, so cloth moves.
function drawCloth([x, y, w, h, anchor], seed) {
  const img = images.map;
  if (!img) return;
  const s = img.width / MAP.w;
  const t = state.time * 2.4 + seed;
  if (anchor === 'top') {
    const rows = Math.ceil(h / 2);
    for (let r = 0; r < rows; r++) {
      const ry = y + r * 2;
      const k = r / rows;
      const off = Math.sin(t + ry * 0.09) * 1.6 * k;
      ctx.drawImage(img, x * s, ry * s, w * s, 2 * s, x + off, ry, w, 2.2);
    }
  } else {
    const cols = Math.ceil(w / 2);
    for (let c = 0; c < cols; c++) {
      const cx = x + c * 2;
      const k = c / cols;
      const off = Math.sin(t * 1.6 - cx * 0.18) * 2.6 * k;
      ctx.drawImage(img, cx * s, y * s, 2 * s, h * s, cx, y + off, 2.2, h);
    }
  }
}

function drawSmoke() {
  for (const s of smoke) {
    const k = s.life / s.max;
    const a = Math.min(1, s.life * 3) * (1 - k) * 0.38;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(238,234,226,${a})`);
    g.addColorStop(1, 'rgba(238,234,226,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLeaves() {
  for (const l of leaves) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.spin);
    ctx.scale(1, 0.55 + 0.45 * Math.sin(l.spin * 1.7));
    ctx.fillStyle = l.hue;
    ctx.strokeStyle = 'rgba(70,40,20,0.6)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-l.size, 0);
    ctx.quadraticCurveTo(0, -l.size * 0.7, l.size, 0);
    ctx.quadraticCurveTo(0, l.size * 0.7, -l.size, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawJukeboxLife() {
  const [x, y] = MAP_FX.jukebox;
  const h = 62 * (images['prop:jukebox'] ? images['prop:jukebox'].height / images['prop:jukebox'].width : 1.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(x, y - h * 0.55, 44 * flicker(3, 0.8), '255,180,90', 0.35);
  ctx.restore();
  // little notes drifting up out of it
  for (let i = 0; i < 3; i++) {
    const k = (state.time * 0.35 + i / 3) % 1;
    const nx = x - 14 + i * 12 + Math.sin(state.time * 2 + i) * 8;
    const ny = y - h - 4 - k * 46;
    ctx.save();
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.fillStyle = '#f2c14e';
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(nx, ny, 3.2, 2.4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(nx + 2.8, ny);
    ctx.lineTo(nx + 2.8, ny - 11);
    ctx.quadraticCurveTo(nx + 7, ny - 8, nx + 6, ny - 4);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- Kevin follows Harm ----------

// Kevin walks the path Harm walked, a step behind, so they never cut through walls.
function placeKevinBehind(dx, dy) {
  const k = state.kevin, p = state.player, gap = personHeight() * 0.5;
  k.x = p.x + dx * gap;
  k.y = p.y + dy * gap;
  if (!canStand(k.x, k.y)) { k.x = p.x; k.y = p.y; }
  k.dir = p.dir;
  state.trail = [];
}

function updateKevin(dt) {
  const p = state.player, k = state.kevin;
  const last = state.trail[state.trail.length - 1];
  if (!last || Math.hypot(p.x - last[0], p.y - last[1]) > 3) state.trail.push([p.x, p.y]);
  if (state.trail.length > 400) state.trail.splice(0, state.trail.length - 400);

  // the point on Harm's path one follow-distance behind Harm
  const behind = personHeight() * KEVIN.followDistance;
  let target = null, walked = 0;
  for (let i = state.trail.length - 1; i > 0; i--) {
    const [x1, y1] = state.trail[i], [x0, y0] = state.trail[i - 1];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (walked + seg >= behind) { const t = (behind - walked) / seg; target = [x1 + (x0 - x1) * t, y1 + (y0 - y1) * t]; break; }
    walked += seg;
  }
  k.moving = false;
  if (target) {
    const tx = target[0] - k.x, ty = target[1] - k.y, d = Math.hypot(tx, ty);
    if (d > personHeight() * 6) { k.x = target[0]; k.y = target[1]; }      // fell far behind: catch up
    else if (d > 2) {
      const speed = Math.min(d, (state.scene === 'map' ? 210 : 255) * dt * (d > behind * 0.5 ? 1.25 : 1));
      k.x += (tx / d) * speed; k.y += (ty / d) * speed; k.moving = true;
      k.phase = (k.phase || 0) + speed / (personHeight() * 0.2);
      k.dir = Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up');
    }
  }
  if (!k.moving && !p.moving) {                                            // standing: turn toward Harm
    const tx = p.x - k.x, ty = p.y - k.y;
    if (Math.hypot(tx, ty) > 4) k.dir = Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up');
  }
}

function kevinOnCall() {
  return state.time < state.kevin.callUntil;
}

// ---------- characters ----------

const WALK_CYCLE = [0, 1, 2, 1];

function drawWalker(g, who, S) {
  const img = images[S.image];
  if (!img) return false;
  const scale = personHeight() / S.figure;
  const col = who.moving ? WALK_CYCLE[Math.floor(who.phase || 0) % 4] : 1;   // legs move by distance walked
  const row = S.rows[who.dir];
  g.save();
  g.fillStyle = 'rgba(40,25,10,0.28)';
  g.beginPath();
  g.ellipse(who.x, who.y, S.frameW * scale * 0.2, S.frameW * scale * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  g.drawImage(img, col * S.frameW, row * S.frameH, S.frameW, S.frameH,
    who.x - (S.frameW * scale) / 2, who.y - S.foot * scale, S.frameW * scale, S.frameH * scale);
  g.restore();
  return true;
}

function drawCEO(g = ctx) {
  if (!drawWalker(g, state.player, WALK_SHEET)) drawStandIn(g);
}

function drawKevin(g = ctx) {
  drawWalker(g, state.kevin, kevinOnCall() ? KEVIN_PHONE_SHEET : KEVIN_SHEET);
}

// The simple drawn figure, used only if the walking sheet is missing.
function drawStandIn(g = ctx) {
  const p = state.player;
  const H = personHeight();
  const u = H / 46;
  const swingLeg = Math.sin(p.step) * 4 * u;
  const bob = p.moving ? Math.abs(Math.sin(p.step)) * -1.2 * u : 0;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = 'rgba(40,25,10,0.28)';
  g.beginPath();
  g.ellipse(0, 0, 11 * u, 4 * u, 0, 0, Math.PI * 2);
  g.fill();
  g.translate(0, bob);
  g.scale(p.facing, 1);
  g.lineJoin = 'round';
  g.strokeStyle = '#1d1a24';
  g.lineWidth = 1.2 * u;
  // legs
  g.fillStyle = '#2b3245';
  g.fillRect(-5 * u + swingLeg * 0.5, -16 * u, 4 * u, 16 * u);
  g.fillRect(1 * u - swingLeg * 0.5, -16 * u, 4 * u, 16 * u);
  g.fillStyle = '#3a2416';
  g.fillRect(-6 * u + swingLeg * 0.5, -2.5 * u, 6 * u, 2.5 * u);
  g.fillRect(0.5 * u - swingLeg * 0.5, -2.5 * u, 6 * u, 2.5 * u);
  // suit jacket
  g.fillStyle = '#28324d';
  g.beginPath();
  g.moveTo(-8 * u, -15 * u);
  g.lineTo(-7 * u, -31 * u);
  g.quadraticCurveTo(0, -35 * u, 7 * u, -31 * u);
  g.lineTo(8 * u, -15 * u);
  g.closePath();
  g.fill();
  g.stroke();
  // shirt and gold tie
  g.fillStyle = '#f4efe6';
  g.beginPath();
  g.moveTo(-3 * u, -32 * u); g.lineTo(3 * u, -32 * u); g.lineTo(0, -24 * u); g.closePath();
  g.fill();
  g.fillStyle = '#d4a017';
  g.beginPath();
  g.moveTo(-1 * u, -31 * u); g.lineTo(1 * u, -31 * u); g.lineTo(1.4 * u, -23 * u); g.lineTo(0, -21.5 * u); g.lineTo(-1.4 * u, -23 * u); g.closePath();
  g.fill();
  // arms
  g.fillStyle = '#28324d';
  g.fillRect(-10 * u, -30 * u - swingLeg * 0.3, 3.4 * u, 13 * u);
  g.fillRect(6.6 * u, -30 * u + swingLeg * 0.3, 3.4 * u, 13 * u);
  g.fillStyle = '#e9b98f';
  g.beginPath(); g.arc(-8.3 * u, -16.5 * u - swingLeg * 0.3, 1.8 * u, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(8.3 * u, -16.5 * u + swingLeg * 0.3, 1.8 * u, 0, Math.PI * 2); g.fill();
  // head
  g.fillStyle = '#e9b98f';
  g.beginPath(); g.arc(0, -39 * u, 6 * u, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#4a2f1c';
  g.beginPath(); g.arc(0, -41 * u, 6.2 * u, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  g.fillStyle = '#1d1a24';
  g.beginPath(); g.arc(2.6 * u, -39 * u, 0.9 * u, 0, Math.PI * 2); g.fill();
  g.restore();
}

// The CEO, with whatever he is under or behind showing through.
function drawCEOInPlace() {
  const p = state.player, H = personHeight();
  const bbox = { x: p.x - H * 0.45, y: p.y - H * 1.06, w: H * 0.9, h: H * 1.13 };
  drawWithCover(ctx, layerFor(state.scene), bbox, p.y, drawCEO);
}

function drawKevinInPlace() {
  const k = state.kevin, H = personHeight();
  const bbox = { x: k.x - H * 0.45, y: k.y - H * 1.06, w: H * 0.9, h: H * 1.13 };
  drawWithCover(ctx, layerFor(state.scene), bbox, k.y, drawKevin);
}

// ---------- drawing ----------

function drawProp([name, x, y, w]) {
  const img = images['prop:' + name];
  if (!img) return;
  const h = (w * img.height) / img.width;
  ctx.save();
  if (name.startsWith('council-chair')) ctx.filter = 'saturate(0.55) brightness(0.92)'; // match the hall's own chairs
  ctx.drawImage(img, x - w / 2, y - h, w, h);
  ctx.restore();
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const cam = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1b140e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (W / 2 - cam.x * cam.zoom), dpr * (H / 2 - cam.y * cam.zoom));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (state.scene === 'map') drawTown();
  else drawRoom(state.scene);

  drawEditor(ctx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state.fade > 0) {
    ctx.fillStyle = `rgba(20,14,8,${Math.min(1, state.fade * 1.4)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawTown() {
  if (images.map) ctx.drawImage(images.map, 0, 0, MAP.w, MAP.h);
  MAP_FX.cloth.forEach((c, i) => drawCloth(c, i * 1.7));
  drawFountain();
  // props and the CEO, back to front
  const things = MAP_PROPS.map((p) => ({ y: p[2], draw: () => drawProp(p) }));
  things.push({ y: state.player.y, draw: drawCEOInPlace });
  things.push({ y: state.kevin.y - 0.01, draw: drawKevinInPlace });
  if (typeof residentsHere === 'function') for (const r of residentsHere()) things.push({ y: r.y, draw: () => drawResidentInPlace(r) });
  things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
  if (typeof drawNameTags === 'function') drawNameTags();
  drawJukeboxLife();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  MAP_FX.glows.forEach((g, i) => drawGlow(g.x, g.y, g.r * flicker(i), g.color, g.sparkle ? 0.25 + 0.25 * Math.max(0, Math.sin(state.time * 1.5)) : 0.45));
  for (const p of MAP_PROPS) {
    if (p[0] === 'lamp-post') drawGlow(p[1], p[2] - p[3] * 2.25, p[3] * 0.9 * flicker(p[1]), '255,200,110', 0.5);
    if (p[0] === 'lamp-hanging') drawGlow(p[1] + p[3] * 0.25, p[2] - p[3] * 1.55, p[3] * 0.55 * flicker(p[2]), '255,200,110', 0.5);
  }
  ctx.restore();
  MAP_FX.fire.forEach((f, i) => drawFire(f, i));
  MAP_FX.orbs.forEach((o, i) => drawOrb(o, i));
  drawSmoke();
  drawLeaves();
}

function drawRoom(id) {
  const room = ROOMS[id];
  const img = images['room:' + id];
  if (img) ctx.drawImage(img, 0, 0, ROOM_W, ROOM_H);
  const things = (room.props || []).map((p) => ({ y: p[2], draw: () => drawProp(p) }));
  if (state.meeting) things.push(...meetingThings());
  else {
    things.push({ y: state.player.y, draw: drawCEOInPlace });
    things.push({ y: state.kevin.y - 0.01, draw: drawKevinInPlace });
    if (typeof residentsHere === 'function') for (const r of residentsHere()) things.push({ y: r.y, draw: () => drawResidentInPlace(r) });
  }
  things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
  if (typeof drawNameTags === 'function') drawNameTags();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  (room.glows || []).forEach(([x, y, r, color], i) => drawGlow(x, y, r * 1.8 * flicker(i * 1.9, 1.2), color || '255,200,110', 0.45));
  ctx.restore();
  (room.fire || []).forEach((f, i) => drawFire(f, i + 5));
  (room.orbs || []).forEach((o, i) => drawOrb(o, i + 3));
}

// ---------- page controls ----------

const placeName = document.getElementById('place-name');
const placeJob = document.getElementById('place-job');
function setPlace(name, job) {
  placeName.textContent = name;
  placeJob.textContent = job;
}

let toastTimer = 0;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function zoomBy(factor, sx = canvas.clientWidth / 2, sy = canvas.clientHeight / 2) {
  const cam = state.camera;
  const key = state.scene === 'map' ? 'map' : 'room';
  const before = screenToWorld(sx, sy);
  const minF = state.scene === 'map' ? 1 : 1, maxF = 5;
  state.zoomFactor[key] = Math.min(maxF, Math.max(minF, state.zoomFactor[key] * factor));
  cam.zoom = fitZoom() * state.zoomFactor[key];
  const after = screenToWorld(sx, sy);
  cam.x += before[0] - after[0];
  cam.y += before[1] - after[1];
}

function screenToWorld(sx, sy) {
  const cam = state.camera;
  return [cam.x + (sx - canvas.clientWidth / 2) / cam.zoom, cam.y + (sy - canvas.clientHeight / 2) / cam.zoom];
}

window.addEventListener('keydown', (e) => {
  if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;   // typing in a box, not walking
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  // M (sound / M M for Kevin), T (talk) and C (village talk) live in game/talk.js
  if (k === '+' || k === '=') zoomBy(1.2);
  if (k === '-') zoomBy(1 / 1.2);
  keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.offsetX, e.offsetY);
}, { passive: false });
// Two fingers on a phone: pinch to zoom (and don't walk anywhere). Registered first, so it wins.
const touches = new Map();
let pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (touches.size >= 2) {
    const [a, b] = [...touches.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) };
    state.target = null;
    e.stopImmediatePropagation();
  }
}, true);
canvas.addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (!pinch || touches.size < 2) return;
  const [a, b] = [...touches.values()];
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (pinch.d > 10 && d > 10) zoomBy(d / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  pinch.d = d;
  state.target = null;
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(ev, (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
});
canvas.addEventListener('pointerdown', (e) => {
  if (pinch) return;
  state.target = screenToWorld(e.offsetX, e.offsetY);
});
window.addEventListener('resize', () => {
  state.camera.zoom = fitZoom() * state.zoomFactor[state.scene === 'map' ? 'map' : 'room'];
});

const soundBtn = document.getElementById('sound');
function toggleSound() {
  audio.setMuted(!audio.muted);
  soundBtn.setAttribute('aria-pressed', String(!audio.muted));
  soundBtn.textContent = audio.muted ? 'Geluid uit' : 'Geluid aan';
}
soundBtn.addEventListener('click', toggleSound);
document.getElementById('zoom-in').addEventListener('click', () => zoomBy(1.25));
document.getElementById('zoom-out').addEventListener('click', () => zoomBy(1 / 1.25));

document.getElementById('enter').addEventListener('click', () => {
  document.getElementById('intro').hidden = true;
  audio.start();
  canvas.focus();
});

// ---------- go ----------

// Start once the pictures are in AND every script on the page has run: with pictures from the cache the
// loading can finish before the last script (talk.js, meeting.js) has run.
const allScriptsRun = new Promise((resolve) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', resolve) : resolve()));
Promise.all([loading, allScriptsRun]).then(() => {
  document.getElementById('enter').disabled = false;
  document.getElementById('enter').textContent = 'Het dorp in';
  state.camera.zoom = fitZoom() * state.zoomFactor.map;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
