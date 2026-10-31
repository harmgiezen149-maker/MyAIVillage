// The directors and their workers: who they are, where they live, and how they spend the day.
// Directors mostly hang out in their yard and their house; each worker stays near their director.
// Names can be changed in the edit menu (key E); changed names are saved to the page's own storage.

const DIRECTORS = [
  { id: 'margot-finch', name: 'Margot Finch', house: 'post-house', worker: { id: 'juno-park', name: 'Juno Park' } },
  { id: 'theo-ashworth', name: 'Theo Ashworth', house: 'counting-house', worker: { id: 'felix-moss', name: 'Felix Moss' } },
  { id: 'imani-okafor', name: 'Imani Okafor', house: 'scholars-tower', worker: { id: 'iris-chen', name: 'Iris Chen' } },
  { id: 'rafael-moreno', name: 'Rafael Moreno', house: 'artisans-workshop', worker: { id: 'otto-brandt', name: 'Otto Brandt' } },
  { id: 'rosie-bell', name: 'Rosie Bell', house: 'family-cottage', worker: { id: 'daisy-quinn', name: 'Daisy Quinn' } },
  { id: 'jasper-vale', name: 'Jasper Vale', house: 'bards-house', worker: { id: 'remy-dubois', name: 'Remy Dubois' } },
  { id: 'nova-lindqvist', name: 'Nova Lindqvist', house: 'criers-press', worker: { id: 'kai-tanaka', name: 'Kai Tanaka' } },
  { id: 'leo-castellano', name: 'Leo Castellano', house: 'heralds-lodge', worker: { id: 'sol-rivera', name: 'Sol Rivera' } },
  { id: 'greta-holm', name: 'Greta Holm', house: 'carriers-depot', worker: { id: 'hugo-lind', name: 'Hugo Lind' } },
];

const residents = [];
for (const d of DIRECTORS) {
  const b = BUILDINGS.find((x) => x.id === d.house);
  const director = {
    id: d.id, name: d.name, role: 'Director', house: d.house, building: b,
    sheet: { ...WALK_SHEET, image: 'char:' + d.id, src: `assets/characters/${d.id}-walk.png` },
    where: Math.random() < 0.6 ? 'map' : d.house,
    x: 0, y: 0, dir: 'down', step: 0, moving: false, target: null, wait: Math.random() * 3, stayUntil: 0, trail: [],
  };
  placeAtHome(director);
  const worker = {
    id: d.worker.id, name: d.worker.name, role: 'Worker', house: d.house, building: b, boss: director,
    sheet: { ...WALK_SHEET, image: 'char:' + d.worker.id, src: `assets/characters/${d.worker.id}-walk.png` },
    where: director.where, x: director.x + 30, y: director.y + 20, dir: 'down', step: 0, moving: false,
  };
  director.workerRef = worker;
  residents.push(director, worker);
}

function roleLabel(r) {
  return r.role === 'Director' ? `Director · ${r.building.name}` : `Worker · ${r.building.name} (reports to ${r.boss.name.split(' ')[0]})`;
}

// ---------- where they can stand ----------

function sceneLayer(where) {
  return layers[where === 'map' ? 'town' : where];
}
function canStandIn(where, x, y) {
  if (!isWalkable(sceneLayer(where), x, y)) return false;
  const props = where === 'map' ? MAP_PROPS : (ROOMS[where].props || []);
  return !hitsObstacle(x, y, propFootprints(props));
}
function heightIn(where) {
  return where === 'map' ? 92 : ROOM_H / 6;
}

// The yard: open ground around the front door. The house: the room floor.
function randomSpot(r) {
  for (let i = 0; i < 40; i++) {
    let x, y;
    if (r.where === 'map') {
      const [dx, dy] = r.building.door;
      x = dx + (Math.random() - 0.5) * 260;
      y = dy + 30 + Math.random() * 150;
    } else {
      const [fx, fy, fw, fh] = ROOMS[r.where].floor;
      x = fx + Math.random() * fw;
      y = fy + Math.random() * fh;
    }
    if (canStandIn(r.where, x, y)) return [x, y];
  }
  return null;
}

function placeAtHome(r) {
  if (r.where === 'map') {
    const spot = randomSpot(r) || [r.building.door[0], r.building.door[1] + 40];
    [r.x, r.y] = spot;
  } else {
    const room = ROOMS[r.where];
    [r.x, r.y] = randomSpot(r) || room.start || [room.exit[0], room.exit[1] - 70];
  }
  r.stayUntil = state.time + 25 + Math.random() * 35;
}

// ---------- moving ----------

function stepToward(r, tx, ty, speed, dt) {
  const ddx = tx - r.x, ddy = ty - r.y, d = Math.hypot(ddx, ddy);
  if (d < 3) return true;
  const s = Math.min(d, speed * dt);
  const nx = r.x + (ddx / d) * s, ny = r.y + (ddy / d) * s;
  r.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'right' : 'left') : (ddy > 0 ? 'down' : 'up');
  if (!canStandIn(r.where, nx, ny)) return null;   // blocked: give up on this target
  r.x = nx; r.y = ny; r.moving = true;
  return false;
}

function updateDirector(r, dt) {
  r.moving = false;
  const speed = (r.where === 'map' ? 120 : 150);
  // time to swap between yard and house: walk to the door first
  if (state.time > r.stayUntil && !r.leaving) {
    r.leaving = true;
    r.target = r.where === 'map' ? r.building.door.slice() : ROOMS[r.where].exit.slice();
  }
  if (r.leaving) {
    const arrived = stepToward(r, r.target[0], r.target[1], speed, dt);
    if (arrived || arrived === null) {
      r.where = r.where === 'map' ? r.house : 'map';
      if (r.where === 'map') { r.x = r.building.door[0]; r.y = r.building.door[1] + 30; r.stayUntil = state.time + 30 + Math.random() * 40; }
      else placeAtHome(r);
      r.leaving = false; r.target = null; r.wait = 1;
      r.workerRef.where = r.where; r.workerRef.x = r.x + 24; r.workerRef.y = r.y + 18;
      r.trail = [];
    }
  } else if (r.wait > 0) {
    r.wait -= dt;
  } else if (!r.target) {
    r.target = randomSpot(r);
    if (!r.target) r.wait = 2;
  } else {
    const arrived = stepToward(r, r.target[0], r.target[1], speed, dt);
    if (arrived || arrived === null) { r.target = null; r.wait = 2 + Math.random() * 5; }
  }
  r.step = r.moving ? r.step + dt * 8 : 0;
  const last = r.trail[r.trail.length - 1];
  if (!last || Math.hypot(r.x - last[0], r.y - last[1]) > 3) r.trail.push([r.x, r.y]);
  if (r.trail.length > 200) r.trail.splice(0, r.trail.length - 200);
}

// Workers keep a couple of steps behind their director, on the director's own path.
function updateWorker(w, dt) {
  const boss = w.boss;
  w.moving = false;
  if (w.where !== boss.where) { w.where = boss.where; w.x = boss.x; w.y = boss.y; }
  const behind = heightIn(w.where) * 0.8;
  let target = null, walked = 0;
  for (let i = boss.trail.length - 1; i > 0; i--) {
    const [x1, y1] = boss.trail[i], [x0, y0] = boss.trail[i - 1];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (walked + seg >= behind) { const t = (behind - walked) / seg; target = [x1 + (x0 - x1) * t, y1 + (y0 - y1) * t]; break; }
    walked += seg;
  }
  if (target) {
    const d = Math.hypot(target[0] - w.x, target[1] - w.y);
    if (d > heightIn(w.where) * 5) { w.x = target[0]; w.y = target[1]; }
    else if (d > 2) {
      const s = Math.min(d, 140 * dt * (d > behind * 0.5 ? 1.2 : 1));
      const ddx = target[0] - w.x, ddy = target[1] - w.y;
      w.x += (ddx / d) * s; w.y += (ddy / d) * s; w.moving = true;
      w.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'right' : 'left') : (ddy > 0 ? 'down' : 'up');
    }
  }
  if (!w.moving && !boss.moving) {
    const ddx = boss.x - w.x, ddy = boss.y - w.y;
    if (Math.hypot(ddx, ddy) > 4) w.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'right' : 'left') : (ddy > 0 ? 'down' : 'up');
  }
  w.step = w.moving ? w.step + dt * 8 : 0;
}

function updateResidents(dt) {
  for (const r of residents) (r.role === 'Director' ? updateDirector : updateWorker)(r, dt);
}

// ---------- drawing ----------

function residentsHere() {
  return residents.filter((r) => r.where === state.scene);
}

function drawResidentInPlace(r) {
  const H = personHeight();
  const bbox = { x: r.x - H * 0.45, y: r.y - H * 1.06, w: H * 0.9, h: H * 1.13 };
  drawWithCover(ctx, layerFor(state.scene), bbox, r.y, (g) => drawWalker(g, r, r.sheet));
}

// A small name tag over anyone the CEO walks up to.
function drawNameTags() {
  const H = personHeight();
  // walking: tags over everyone near Harm; in a meeting: only the person under the mouse
  const p = !state.meeting ? state.player : state.pointer ? { x: state.pointer[0], y: state.pointer[1] + H * 0.45 } : null;
  if (!p) return;
  let people = [...residentsHere(), { ...state.kevin, name: KEVIN.name, role: 'Kevin' }];
  if (state.meeting) {
    people.push({ ...state.player, name: 'Harm', role: 'Harm' });
    const near = people.map((r) => [Math.hypot(r.x - p.x, r.y - p.y), r]).filter(([d]) => d < H * 0.45).sort((a, b) => a[0] - b[0]);
    people = near.length ? [near[0][1]] : [];
  }
  ctx.save();
  ctx.font = `${Math.max(9, H * 0.16)}px Georgia, serif`;
  ctx.textAlign = 'center';
  const placed = [];
  for (const r of people) {
    if (Math.hypot(r.x - p.x, r.y - p.y) > H * 1.6) continue;
    const label = r.name, w = ctx.measureText(label).width + H * 0.2;
    let y = r.y - H * 1.12;
    while (placed.some((t) => Math.abs(t.x - r.x) < (t.w + w) / 2 && Math.abs(t.y - y) < H * 0.25)) y -= H * 0.26;  // stack, don't overlap
    placed.push({ x: r.x, y, w });
    ctx.fillStyle = 'rgba(32,22,14,0.82)';
    ctx.fillRect(r.x - w / 2, y - H * 0.17, w, H * 0.23);
    ctx.fillStyle = r.role === 'Worker' ? '#ffd84a' : '#f2c14e';
    ctx.fillText(label, r.x, y);
  }
  ctx.restore();
}

// ---------- names (edit menu) ----------

function applyNames(saved) {
  for (const r of residents) if (saved[r.id]) r.name = saved[r.id];
  renderNameList();
}

function renderNameList() {
  const list = document.getElementById('names');
  if (!list) return;
  list.innerHTML = '';
  for (const r of residents) {
    const row = document.createElement('label');
    row.className = 'name-row';
    row.innerHTML = `<span class="role ${r.role === 'Worker' ? 'worker' : ''}">${r.role === 'Worker' ? 'Worker' : 'Director'} · ${r.building.name}</span>`;
    const input = document.createElement('input');
    input.value = r.name;
    input.maxLength = 40;
    input.addEventListener('keydown', (e) => e.stopPropagation());   // typing doesn't walk the CEO
    input.addEventListener('change', () => {
      const v = input.value.trim();
      if (!v) { input.value = r.name; return; }
      r.name = v;
      saveNames();
    });
    row.appendChild(input);
    list.appendChild(row);
  }
}

async function saveNames() {
  const db = await getDb();
  const status = document.getElementById('names-status');
  if (!db) { status.textContent = 'Name changed for now. Saving only works on the claude.ai page.'; return; }
  const names = {};
  for (const r of residents) names[r.id] = r.name;
  try {
    await db.doc('settings/names').set({ names, savedAt: new Date().toISOString() });
    status.textContent = 'Names saved ✓';
  } catch (err) {
    status.textContent = 'Could not save the names just now.';
  }
}

renderNameList();
getDb().then(async (db) => {
  if (!db) return;
  try {
    const snap = await db.doc('settings/names').get();
    if (snap.exists && snap.data().names) applyNames(snap.data().names);
  } catch (err) { /* keep the default names */ }
});

for (const r of residents) loadImage(r.sheet.image, r.sheet.src);
