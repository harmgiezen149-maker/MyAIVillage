// The directors and their workers: who they are, where they live, and how they spend the day.
//
// Rules (Harm, 2026-10-31):
// - Working: walk home, go inside, sit at the desk (workers stand at their spot in their director's house).
// - Not working: directors hang out in their own yard and pace a little; workers walk around the whole town.
// - When Harm walks near someone, they stop and turn to look at Harm.
// - A worker who bumps into someone they haven't talked to today stops and asks what that person is working on;
//   both take a note. Already talked today: they walk on by.
// - Everyone stays on walkable ground (game/nav.js), walks around each other, never through walls or furniture,
//   and walks through the door to go in or out. Legs move by distance walked; everyone faces the way they walk.
// Without a task, "working" follows a simple routine (work for a while, then a break). With a task from Harm's
// to-do list they stay at work until it is done (game/office.js). Harm can call anyone over (game/talk.js).

const DIRECTORS = [
  { id: 'margot-finch', name: 'Margot Finch', house: 'post-house',
    bio: 'Leidt het Posthuis: houdt je inbox en e-mail op orde en beantwoord.',
    seat: { seat: [938, 520], dir: 'left', desk: [660, 404, 191, 241] },
    worker: { id: 'juno-park', name: 'Juno Park', bio: 'Stagiair van Margot: helpt de inbox sorteren en antwoorden opstellen.', spot: [400, 470], dir: 'up' } },
  { id: 'theo-ashworth', name: 'Theo Ashworth', house: 'counting-house',
    bio: 'Leidt het Rekenhuis: zorgt voor je geld, rekeningen en budgetten.',
    seat: { seat: [842, 385], dir: 'down', desk: [807, 413, 180, 213] },
    worker: { id: 'felix-moss', name: 'Felix Moss', bio: 'Stagiair van Theo: houdt bonnetjes en cijfers netjes bij.', spot: [430, 650], dir: 'up' } },
  { id: 'imani-okafor', name: 'Imani Okafor', house: 'scholars-tower',
    bio: 'Leidt de Geleerdentoren: zoekt alles uit wat je wilt weten.',
    seat: { seat: [990, 420], dir: 'down', desk: [785, 403, 311, 219] },
    worker: { id: 'iris-chen', name: 'Iris Chen', bio: 'Stagiair van Imani: zoekt bronnen en controleert feiten.', spot: [600, 420], dir: 'up' } },
  { id: 'rafael-moreno', name: 'Rafael Moreno', house: 'artisans-workshop',
    bio: 'Leidt de Werkplaats: ontwerpt en bouwt je producten.',
    seat: { seat: [676, 575], dir: 'left', desk: [463, 577, 235, 185] },
    worker: { id: 'otto-brandt', name: 'Otto Brandt', bio: 'Stagiair van Rafael: bouwt en test onderdelen.', spot: [560, 470], dir: 'left' } },
  { id: 'rosie-bell', name: 'Rosie Bell', house: 'family-cottage',
    bio: 'Dorpstherapeut (zij/haar), in de Praktijk van Rosie: neemt \'s avonds samen met Harm de dag door en helpt de positieve ervaringen opmerken en vasthouden. Zorgt daarnaast nog steeds voor de familie en het kookboek (recepten, weekmenu, boodschappen).',
    seat: { seat: [861, 330], dir: 'up', desk: null },
    worker: { id: 'daisy-quinn', name: 'Daisy Quinn', bio: 'Stagiair van Rosie: houdt de familieagenda, het weekmenu en de boodschappenlijst bij.', spot: [760, 520], dir: 'right' } },
  { id: 'jasper-vale', name: 'Jasper Vale', house: 'bards-house',
    bio: 'Leidt het Bardenhuis: zorgt voor je muziek, ook darkglass (je baspresets en setlists).',
    seat: { seat: [333, 530], dir: 'left', desk: [109, 451, 185, 224] },
    worker: { id: 'remy-dubois', name: 'Remy Dubois', bio: 'Stagiair van Jasper: houdt playlists, muzieknotities en de darkglass-setlists op orde.', spot: [600, 520], dir: 'up' } },
  { id: 'nova-lindqvist', name: 'Nova Lindqvist', house: 'criers-press',
    bio: 'Leidt de Drukkerij: volgt het AI-nieuws en vertelt je wat ertoe doet.',
    seat: { seat: [995, 395], dir: 'down', desk: [785, 403, 311, 219] },
    worker: { id: 'kai-tanaka', name: 'Kai Tanaka', bio: 'Stagiair van Nova: verzamelt de AI-koppen van de dag.', spot: [470, 520], dir: 'up' } },
  { id: 'leo-castellano', name: 'Leo Castellano', house: 'heralds-lodge',
    bio: 'Leidt het Herautenhuis: neemt namens jou contact op met mensen.',
    seat: { seat: [706, 335], dir: 'down', desk: [605, 359, 218, 120] },
    worker: { id: 'sol-rivera', name: 'Sol Rivera', bio: 'Stagiair van Leo: houdt contactlijsten en opvolging bij.', spot: [520, 420], dir: 'up' } },
  { id: 'greta-holm', name: 'Greta Holm', house: 'carriers-depot',
    bio: 'Leidt het Vrachtdepot: plant je logistiek, leveringen en reizen.',
    seat: { seat: [1000, 650], dir: 'left', desk: [758, 502, 262, 218] },
    worker: { id: 'hugo-lind', name: 'Hugo Lind', bio: 'Stagiair van Greta: volgt pakketjes, boekingen en dienstregelingen.', spot: [460, 580], dir: 'up' } },
];
const KEVIN_BIO = 'Stafchef: je rechterhand. Neemt je opdrachten aan en geeft ze door aan de directeuren.';

const residents = [];
for (const d of DIRECTORS) {
  const b = BUILDINGS.find((x) => x.id === d.house);
  const base = { where: 'map', x: 0, y: 0, dir: 'down', moving: false, phase: 0, plan: null, path: null, state: 'idle',
    wait: Math.random() * 2, seated: null, mode: 'free', modeUntil: 0, notes: [] };
  const director = { ...base, id: d.id, name: d.name, role: 'Director', house: d.house, building: b, bio: d.bio,
    sheet: { ...WALK_SHEET, image: 'char:' + d.id, src: `assets/characters/${d.id}-walk.png` }, desk: d.seat };
  const worker = { ...base, notes: [], id: d.worker.id, name: d.worker.name, role: 'Worker', house: d.house, building: b,
    bio: d.worker.bio, boss: director, workSpot: { spot: d.worker.spot, dir: d.worker.dir },
    sheet: { ...WALK_SHEET, image: 'char:' + d.worker.id, src: `assets/characters/${d.worker.id}-walk.png` } };
  director.workerRef = worker;
  residents.push(director, worker);
}

function roleLabel(r) {
  return r.role === 'Director' ? `Directeur · ${r.building.job}` : `Stagiair · ${r.building.name}`;
}
function reportsTo(r) {
  return r.role === 'Director' ? `${KEVIN.name} (stafchef)` : `${r.boss.name} (directeur, ${r.boss.building.job.toLowerCase()})`;
}
function heightIn(where) {
  return where === 'map' ? 92 : ROOM_H / 6;    // for walking and keeping distance: the first sizes (drawing uses personHeight)
}
function walkSpeed(where) {
  return where === 'map' ? 105 : 140;
}

// ---------- places ----------

function yardBox(r) {
  const [dx, dy] = r.building.door;
  return [dx - 170, dy - 30, 340, 220];
}
// A free open spot near (x, y): nobody ends up on top of anyone when stepping through a door.
function freeSpotNear(where, x, y, self) {
  const H = heightIn(where);
  for (let ring = 0; ring < 6; ring++) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + ring, d = ring * H * 0.32;
      const p = nearestOpenPoint(where, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6);
      if (p && spotFree(where, p[0], p[1], self, H * 0.4)) return p;
    }
  }
  return nearestOpenPoint(where, x, y) || [x, y];
}
function roomInside(room) {
  const R = ROOMS[room];
  return R.start || [R.exit[0], R.exit[1] - 70];
}
function deskSeat(r) {
  const s = r.desk, cut = s.desk ? [[s.desk[0], s.desk[1]], [s.desk[0] + s.desk[2], s.desk[1]], [s.desk[0] + s.desk[2], s.desk[1] + s.desk[3]], [s.desk[0], s.desk[1] + s.desk[3]]] : null;
  return { seat: s.seat, dir: s.dir, table: !!cut, cut };
}

// Is a spot free of other people (so nobody ends up standing on top of anyone)?
function spotFree(where, x, y, self, gap) {
  for (const o of everyone()) {
    if (o === self || o.where !== where) continue;
    const ox = o.goal ? o.goal[0] : o.x, oy = o.goal ? o.goal[1] : o.y;
    if (Math.hypot(o.x - x, o.y - y) < gap || Math.hypot(ox - x, oy - y) < gap) return false;
  }
  return true;
}
// Not right in front of a door (people need to get in and out).
function clearOfDoors(where, x, y) {
  const H = heightIn(where);
  const doors = where === 'map' ? BUILDINGS.map((b) => b.door) : [ROOMS[where].exit];
  return doors.every(([dx, dy]) => Math.hypot(dx - x, (dy + H * 0.3) - y) > H * 0.9);
}
// Room around a spot, so nobody stands in a narrow alley where they'd block the way.
function roomy(where, x, y) {
  const R = heightIn(where) * 0.55;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (!navOpenAt(where, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.6)) return false;
  }
  return true;
}
function freeSpotIn(where, box, self) {
  const H = heightIn(where);
  for (let i = 0; i < 30; i++) {
    const p = randomOpenSpot(where, box);
    if (p && spotFree(where, p[0], p[1], self, H * 0.6) && clearOfDoors(where, p[0], p[1]) && roomy(where, p[0], p[1])) return p;
  }
  return randomOpenSpot(where, box);
}

// Everyone who walks around (for avoiding each other): the residents, plus Harm and Kevin.
function everyone() {
  const harm = { id: 'harm', where: state.scene, x: state.player.x, y: state.player.y, still: !state.player.moving };
  const kevin = { id: 'kevin', where: state.scene, x: state.kevin.x, y: state.kevin.y, still: !state.kevin.moving };
  return [...residents, harm, kevin];
}

// ---------- plans: a list of legs, walked one after another ----------
// leg: { where, to: [x, y] } walk there · { door: 'in', room } step through a town door · { door: 'out', room } step out

function planTo(r, where, to, onArrive) {
  const legs = [];
  let at = r.where;
  if (at !== where) {
    if (at !== 'map') { legs.push({ where: at, to: ROOMS[at].exit.slice(), exitLeg: true }); legs.push({ door: 'out', room: at }); at = 'map'; }
    if (where !== 'map') {
      const b = BUILDINGS.find((x) => x.room === where);
      legs.push({ where: 'map', to: b.door.slice(), doorLeg: true });
      legs.push({ door: 'in', room: where });
    }
  }
  legs.push({ where, to: to.slice() });
  r.plan = { legs, onArrive };
  r.goal = to.slice();
  r.path = null;
  r.blocked = 0;
}

function stepThroughDoor(r, leg) {
  if (leg.door === 'in') {
    const [x, y] = roomInside(leg.room);
    r.where = leg.room;
    [r.x, r.y] = freeSpotNear(leg.room, x, y, r); r.dir = 'up';
  } else {
    const b = BUILDINGS.find((x) => x.room === leg.room);
    r.where = 'map';
    [r.x, r.y] = freeSpotNear('map', b.door[0], b.door[1] + 34, r); r.dir = 'down';
  }
  r.path = null;
}

function setDirFrom(r, dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 0.01 && ay < 0.01) return;
  // a little hysteresis so nobody flickers between two directions on a diagonal
  const horiz = r.dir === 'left' || r.dir === 'right';
  const goHoriz = horiz ? ay <= ax * 1.25 : ax > ay * 1.25;
  r.dir = goHoriz ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

// Walk the current plan. Returns true when the whole plan is done.
function followPlan(r, dt) {
  const P = r.plan;
  if (!P) return true;
  let leg = P.legs[0];
  if (!leg) {
    // never stop on top of someone: if the spot got taken, step to a free one next to it
    const H0 = heightIn(r.where);
    if (!P.exact && !spotFree(r.where, r.x, r.y, r, H0 * 0.35) && !P.shuffled) {
      const p = freeSpotNear(r.where, r.x, r.y, r);
      P.legs.push({ where: r.where, to: p }); P.shuffled = true; r.path = null; return false;
    }
    r.plan = null; r.goal = null; if (P.onArrive) P.onArrive(); return true;
  }
  if (leg.door) { stepThroughDoor(r, leg); P.legs.shift(); return false; }
  if (r.where !== leg.where) { P.legs.shift(); return false; }
  if (!r.path) {
    r.path = findPath(r.where, [r.x, r.y], leg.to, standingPeople(r));
    if (!r.path) r.path = findPath(r.where, [r.x, r.y], leg.to);
    if (!r.path) { r.plan = null; r.goal = null; r.wait = 1 + Math.random(); return true; }
    r.path.shift();
    if (leg.doorLeg || leg.exitLeg || !r.path.length) r.path.push(leg.to.slice());
  }
  const H = heightIn(r.where);
  const target = r.path[0];
  if (!target) { P.legs.shift(); r.path = null; return false; }
  const tx = target[0] - r.x, ty = target[1] - r.y, d = Math.hypot(tx, ty);
  const doorway = (leg.doorLeg || leg.exitLeg) && r.path.length === 1;   // the last step into a doorway
  // not getting any closer (someone standing in the way, or two people dancing around each other)?
  if (r.progTarget !== target) { r.progTarget = target; r.bestD = d; r.progT = 0; }
  else if (d < r.bestD - 2) { r.bestD = d; r.progT = 0; }
  else if ((r.progT += dt) > 2.5) {
    r.progT = 0; r.noProg = (r.noProg || 0) + 1; r.path = null;
    if (r.noProg >= 3) {
      r.noProg = 0;
      if (!P.exact && !r.inMeeting) { r.plan = null; r.goal = null; r.wait = 0.5 + Math.random(); return true; }   // go somewhere else
      r.squeezeUntil = state.time + 1.5;             // has to get there: squeeze past
    }
    return false;
  }
  if (d < (doorway ? 12 : 3)) { r.path.shift(); if (!r.path.length) { P.legs.shift(); r.path = null; } return false; }
  let vx = tx / d, vy = ty / d;
  // steer around anyone close ahead
  let ax = 0, ay = 0, ahead = null;
  for (const o of everyone()) {
    if (o === r || o.where !== r.where || (o.seated)) continue;
    const ox = o.x - r.x, oy = o.y - r.y, od = Math.hypot(ox, oy);
    if (od > H * 0.75 || od < 0.01) continue;
    const front = (ox * vx + oy * vy) / od;
    if (front < 0.2) continue;
    const side = vx * oy - vy * ox > 0 ? -1 : 1;
    const w = (1 - od / (H * 0.75)) * 1.6;
    ax += -vy * side * w; ay += vx * side * w;
    if (od < H * 0.42 && front > 0.6) ahead = o;
  }
  const speed = walkSpeed(r.where) * (r.inMeeting ? 1.3 : 1);   // hurrying to a meeting
  const step = Math.min(d, speed * dt);
  let mx = vx + ax, my = vy + ay;
  const ml = Math.hypot(mx, my) || 1;
  mx /= ml; my /= ml;
  let nx = r.x + mx * step, ny = r.y + my * step;
  // At a doorway people queue and pass through one at a time, so they don't wait for each other forever.
  const nearDoor = (leg.doorLeg || leg.exitLeg) && Math.hypot(leg.to[0] - r.x, leg.to[1] - r.y) < H * 0.9;
  const sameDoor = (o) => o.plan && o.plan.legs[0] && o.plan.legs[0].to && (o.plan.legs[0].doorLeg || o.plan.legs[0].exitLeg)
    && o.plan.legs[0].to[0] === leg.to[0] && o.plan.legs[0].to[1] === leg.to[1];
  const myDoorDist = Math.hypot(leg.to[0] - r.x, leg.to[1] - r.y);
  const behindMe = (o) => nearDoor && sameDoor(o) && Math.hypot(leg.to[0] - o.x, leg.to[1] - o.y) > myDoorDist;   // first in line goes first
  // Standing people block the way (walk around them); people who are walking too are steered around above.
  const standing = (o) => o.still !== undefined ? o.still : (!o.plan || o.chatting || o.watching);
  const squeeze = (r.inMeeting && r.blocked > 3) || state.time < (r.squeezeUntil || 0);   // crowded: after a while, squeeze past
  const tooClose = (x, y) => !squeeze && everyone().some((o) => o !== r && o.where === r.where && !o.seated && !behindMe(o) && standing(o)
    && Math.hypot(o.x - x, o.y - y) < H * 0.3 && Math.hypot(o.x - x, o.y - y) < Math.hypot(o.x - r.x, o.y - r.y));
  if (doorway && !tooClose(r.x + vx * step, r.y + vy * step)) { nx = r.x + vx * step; ny = r.y + vy * step; }
  else if (!navOpenAt(r.where, nx, ny) || tooClose(nx, ny)) {
    nx = r.x + vx * step; ny = r.y + vy * step;
    if (!tooClose(nx, ny) && !navOpenAt(r.where, nx, ny) && navOpenAt(r.where, r.x, r.y)) {
      // brushing a wall corner: step back to the middle of the open ground first, then carry on
      const c = nearestOpenPoint(r.where, r.x + vx * NAV_CELL, r.y + vy * NAV_CELL);
      if (c) { const cx = c[0] - r.x, cy = c[1] - r.y, cd = Math.hypot(cx, cy) || 1; nx = r.x + (cx / cd) * Math.min(step, cd); ny = r.y + (cy / cd) * Math.min(step, cd); }
    }
    if (tooClose(nx, ny) || (!navOpenAt(r.where, nx, ny) && navOpenAt(r.where, r.x, r.y))) {
      r.moving = false;
      r.blocked += dt;
      if (!tooClose(nx, ny)) {                  // a wall corner, not a person: work out the way again from here
        r.wallHits = (r.wallHits || 0) + 1;
        if (r.wallHits > 4) { const c = nearestOpenPoint(r.where, r.x, r.y); if (c) { r.x = c[0]; r.y = c[1]; } r.wallHits = 0; }
        r.path = null;
        return false;
      }
      // almost there and someone's in the way: this is close enough
      if (P.legs.length === 1 && r.path.length === 1 && d < H * 0.45 && r.blocked > 0.8) { r.path = null; P.legs.shift(); r.blocked = 0; return false; }
      if (ahead && r.blocked > 0.4) setDirFrom(r, ahead.x - r.x, ahead.y - r.y);
      if (r.blocked > 1.6 && !r.inMeeting) { r.path = null; r.blocked = 0; }       // find another way round
      if (r.inMeeting && r.blocked > 1.6 && !r.repathed) { r.path = null; r.repathed = true; }
      return false;
    }
  }
  if (!squeeze) { r.blocked = 0; r.repathed = false; }
  const moved = Math.hypot(nx - r.x, ny - r.y);
  setDirFrom(r, nx - r.x, ny - r.y);
  r.x = nx; r.y = ny;
  r.moving = moved > 0.01;
  r.phase += moved / (H * 0.2);               // legs move by distance walked: no gliding, no walking in place
  return false;
}

function standingPeople(r) {
  const H = heightIn(r.where);
  return everyone().filter((o) => o !== r && o.where === r.where && (o.still || (!o.moving && !o.plan))).map((o) => [o.x, o.y, H * 0.35]);
}

// ---------- the day ----------

function startMode(r, mode) {
  r.mode = mode;
  r.modeUntil = state.time + (mode === 'work' ? 50 + Math.random() * 70 : 45 + Math.random() * 60);
  standUp(r);
  r.plan = null; r.path = null; r.goal = null; r.wait = Math.random() * 1.5; r.paceA = null;
}

function standUp(r) {
  if (!r.seated) return;
  const p = nearestOpenPoint(r.where, r.seated.seat[0], r.seated.seat[1] + 30) || [r.x, r.y];
  r.x = p[0]; r.y = p[1];
  r.seated = null;
}

function sitAt(r, s) {
  r.seated = s;
  const H = heightIn(r.where), off = SEAT_TO_FEET[s.dir];
  r.x = s.seat[0] + off[0] * H; r.y = s.seat[1] + off[1] * H; r.dir = s.dir;
  r.moving = false;
}

// A worker's spot in the house: near the planned one, on open floor with room around it (not blocking the way).
function workSpot(r) {
  if (r.workSpotAt) return r.workSpotAt;
  const [sx, sy] = r.workSpot.spot, N = navFor(r.house);
  let best = null, bestD = Infinity;
  for (const i of N.open) {
    const [x, y] = navCenter(N, i), d = Math.hypot(x - sx, y - sy);
    if (d < bestD && roomy(r.house, x, y) && clearOfDoors(r.house, x, y)) { best = [x, y]; bestD = d; }
  }
  r.workSpotAt = best || nearestOpenPoint(r.house, sx, sy) || roomInside(r.house);
  return r.workSpotAt;
}

function goWork(r) {
  if (r.role === 'Director') {
    const s = deskSeat(r);
    const near = nearestOpenPoint(r.house, s.seat[0], s.seat[1] + 40) || roomInside(r.house);
    planTo(r, r.house, near, () => sitAt(r, s)); r.plan.exact = true;
  } else {
    const p = workSpot(r);
    planTo(r, r.house, p, () => { r.dir = r.workSpot.dir; r.atWork = true; }); r.plan.exact = true;
  }
}

function freeTime(r, dt) {
  if (r.wait > 0) { r.wait -= dt; return; }
  if (r.role === 'Director') {
    // hang out in the yard and pace a little
    if (r.where !== 'map' || !r.paceA) {
      const p = freeSpotIn('map', yardBox(r), r) || freeSpotNear('map', r.building.door[0], r.building.door[1] + 50, r);
      r.paceA = p;
      r.paceB = null;
      planTo(r, 'map', p, () => { r.wait = 2 + Math.random() * 4; });
      return;
    }
    if (!r.paceB || Math.random() < 0.15) {
      const ang = Math.random() * Math.PI * 2, len = 35 + Math.random() * 30;
      const b = [r.paceA[0] + Math.cos(ang) * len, r.paceA[1] + Math.sin(ang) * len * 0.6];
      r.paceB = navOpenAt('map', b[0], b[1]) && spotFree('map', b[0], b[1], r, 50) && clearOfDoors('map', b[0], b[1]) && roomy('map', b[0], b[1]) ? b : null;
      if (!r.paceB) { r.wait = 1; if (Math.random() < 0.3) r.paceA = null; return; }
    }
    const atA = Math.hypot(r.x - r.paceA[0], r.y - r.paceA[1]) < 8;
    const to = atA ? r.paceB : r.paceA;
    planTo(r, 'map', to, () => { r.wait = 1.5 + Math.random() * 3.5; });
  } else {
    // workers walk around the whole town
    const p = freeSpotIn('map', null, r);
    if (!p) { r.wait = 1; return; }
    planTo(r, 'map', p, () => { r.wait = 2 + Math.random() * 4; });
  }
}

// ---------- chatting ----------

const chatLog = { day: '', pairs: new Set() };
function today() { return new Date().toISOString().slice(0, 10); }
function loadChatLog() {
  chatLog.day = today();
  try {
    const saved = JSON.parse(localStorage.getItem('village-chats') || 'null');
    if (saved && saved.day === chatLog.day) {
      for (const p of saved.pairs) chatLog.pairs.add(p);
      for (const r of residents) r.notes = saved.notes[r.id] || [];
    }
  } catch (e) { /* first visit or storage blocked */ }
}
function saveChatLog() {
  try {
    const notes = {};
    for (const r of residents) notes[r.id] = r.notes.slice(-30);
    localStorage.setItem('village-chats', JSON.stringify({ day: chatLog.day, pairs: [...chatLog.pairs], notes }));
  } catch (e) { /* storage blocked: notes live for this visit only */ }
}
function pairKey(a, b) { return [a.id, b.id].sort().join('|'); }
function workingOn(r) {
  return r.task || 'nog geen taken';
}

function tryChat(w) {
  if (chatLog.day !== today()) { chatLog.day = today(); chatLog.pairs.clear(); for (const r of residents) r.notes = []; }
  const H = heightIn(w.where);
  for (const o of residents) {
    if (o === w || o.where !== w.where || o.seated || o.chatting || o.watching || o.inMeeting) continue;
    const gap = Math.hypot(o.x - w.x, o.y - w.y);
    if (gap > H * 0.7 || gap < H * 0.35) continue;      // close enough to talk, not on top of each other
    if (chatLog.pairs.has(pairKey(w, o))) continue;     // already talked today: walk on by
    chatLog.pairs.add(pairKey(w, o));
    const until = state.time + 6 + Math.random() * 3;
    for (const [a, b] of [[w, o], [o, w]]) {
      a.chatting = { with: b, until };
      a.moving = false;
      setDirFrom(a, b.x - a.x, b.y - a.y);
      const time = new Date().toTimeString().slice(0, 5);
      a.notes.push(`${time} · ${b.name} gevraagd waar die mee bezig is: ${workingOn(b)}.`);
    }
    saveChatLog();
    if (typeof villageMet === 'function') villageMet(w, o);   // a real conversation for the village talk log (C)
    return true;
  }
  return false;
}

// ---------- update ----------

function updateResident(r, dt) {
  const H = heightIn(r.where);
  r.moving = false;
  if (typeof therapyHold === 'function' && therapyHold(r, dt)) return;   // a session in the Praktijk (game/therapy.js)
  // chatting: stand still, facing each other
  if (r.chatting) {
    if (state.time > r.chatting.until) { r.chatting = null; r.wait = 0.5; }
    else { setDirFrom(r, r.chatting.with.x - r.x, r.chatting.with.y - r.y); return; }
  }
  // Harm asked them to come over: walk to Harm and stay there
  if (r.summoned && !r.inMeeting) { updateSummoned(r, dt); return; }
  // Harm is talking to them (chat box open): stand still and face Harm
  if (heldByHarm(r)) { setDirFrom(r, state.player.x - r.x, state.player.y - r.y); return; }
  // Harm walks near: stop and turn to look
  if (!r.seated && r.where === state.scene && !(r.noWatchUntil > state.time)) {   // (not when Harm just sent them back to work)
    const d = Math.hypot(state.player.x - r.x, state.player.y - r.y);
    if (d < H * 1.25 || (r.watching && d < H * 1.6)) {
      r.watching = true;
      setDirFrom(r, state.player.x - r.x, state.player.y - r.y);
      return;
    }
  }
  r.watching = false;
  if (r.inMeeting) {               // meetings: walking to the seat or spot, then staying put
    followPlan(r, dt);
    return;
  }
  if (state.time > r.modeUntil) {
    startMode(r, r.mode === 'work' ? 'free' : 'work');
    if (r.mode === 'work') goWork(r);
  }
  if (r.plan) { followPlan(r, dt); if (r.role === 'Worker' && r.mode === 'free' && r.where === 'map') tryChat(r); return; }
  if (r.mode === 'work') {
    if (!r.seated && !r.atWork) goWork(r);
    return;
  }
  r.atWork = false;
  if (r.role === 'Worker' && r.where === 'map' && tryChat(r)) return;
  freeTime(r, dt);
}

function updateResidents(dt) {
  for (const r of residents) updateResident(r, dt);
}

// ---------- start of the day: everyone where their routine says ----------

function placeAtStart(r) {
  r.mode = Math.random() < 0.4 ? 'work' : 'free';
  r.modeUntil = state.time + 10 + Math.random() * 70;
  if (r.mode === 'work') {
    r.where = r.house;
    if (r.role === 'Director') {
      const s = deskSeat(r);
      sitAt(r, s);
    } else {
      const p = workSpot(r);
      r.x = p[0]; r.y = p[1]; r.dir = r.workSpot.dir; r.atWork = true;
    }
  } else {
    r.where = 'map';
    const p = (r.role === 'Director' ? freeSpotIn('map', yardBox(r), r) : freeSpotIn('map', null, r)) || freeSpotNear('map', r.building.door[0], r.building.door[1] + 60, r);
    r.x = p[0]; r.y = p[1];
    if (r.role === 'Director') r.paceA = p;
  }
}
// kept for the meeting code: send a director back to their own yard (walking)
function placeAtHome(r) {
  startMode(r, 'free');
}

// ---------- drawing ----------

function residentsHere() {
  return residents.filter((r) => r.where === state.scene);
}

function drawResidentInPlace(r) {
  if (r.seated) { drawSeated(r.id, r.seated); if (r.chatting) drawChatBubble(r); return; }
  const H = personHeight();
  const bbox = { x: r.x - H * 0.45, y: r.y - H * 1.06, w: H * 0.9, h: H * 1.13 };
  drawWithCover(ctx, layerFor(state.scene), bbox, r.y, (g) => drawWalker(g, r, r.sheet));
  if (r.chatting) drawChatBubble(r);
}

function drawChatBubble(r) {
  const H = personHeight();
  const x = r.x + (r.dir === 'left' ? -H * 0.22 : H * 0.22), y = r.y - H * 1.12;
  const dots = '.'.repeat(1 + (Math.floor(state.time * 2.5 + (r.id.length % 3)) % 3));
  ctx.save();
  ctx.fillStyle = 'rgba(255,250,235,0.92)';
  ctx.strokeStyle = 'rgba(60,40,20,0.6)';
  ctx.lineWidth = Math.max(1, H * 0.012);
  const w = H * 0.34, h = H * 0.2;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - w / 2, y - h, w, h, h * 0.4) : ctx.rect(x - w / 2, y - h, w, h);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2410';
  ctx.font = `bold ${Math.max(8, H * 0.16)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText(dots, x, y - h * 0.3);
  ctx.restore();
}

// A name tag over anyone Harm walks up to (not during meetings: there the meeting box shows who's who).
// Under the name: what they're for, so Harm knows whom to ask about what (Harm, 2026-10-31).
function tagSubtitle(r) {
  if (r.role === 'Kevin') return 'Stafchef · opdrachten';
  if (r.role === 'Director') return r.building.job;
  return 'stagiair van ' + r.boss.name.split(' ')[0];
}
function drawNameTags() {
  if (state.meeting) return;
  const H = personHeight();
  const p = state.player;
  const kevinAway = typeof therapy !== 'undefined' && therapy.active && state.scene === 'family-cottage';   // Kevin waits outside a session
  const people = [...residentsHere(), ...(kevinAway ? [] : [{ ...state.kevin, name: KEVIN.name, role: 'Kevin' }])];
  const z = state.camera.zoom || 1;
  const big = 15 / z, small = 12 / z;   // the same, readable size on screen, however big the figures are drawn
  ctx.save();
  ctx.textAlign = 'center';
  const placed = [];
  for (const r of people) {
    if (Math.hypot(r.x - p.x, r.y - p.y) > H * 1.6) continue;
    const sub = tagSubtitle(r);
    ctx.font = `${big}px Georgia, serif`;
    const w1 = ctx.measureText(r.name).width;
    ctx.font = `${small}px Georgia, serif`;
    const w = Math.max(w1, ctx.measureText(sub).width) + big * 1.2, h = big * 1.15 + small * 1.35;
    let y = r.y - H * (r.seated ? 0.95 : 1.12) - small * 1.3;
    while (placed.some((t) => Math.abs(t.x - r.x) < (t.w + w) / 2 && Math.abs(t.y - y) < h + 2)) y -= h + 3;  // stack, don't overlap
    placed.push({ x: r.x, y, w });
    ctx.fillStyle = 'rgba(32,22,14,0.84)';
    ctx.fillRect(r.x - w / 2, y - big * 1.0, w, h);
    ctx.font = `${big}px Georgia, serif`;
    ctx.fillStyle = r.role === 'Worker' ? '#ffd84a' : '#f2c14e';
    ctx.fillText(r.name, r.x, y);
    ctx.font = `${small}px Georgia, serif`;
    ctx.fillStyle = '#e8d7b6';
    ctx.fillText(sub, r.x, y + small * 1.25);
  }
  ctx.restore();
}

// ---------- hover card ----------

const hoverCard = document.getElementById('hover-card');
function statusLine(r) {
  if (r.inMeeting) return r.seated ? 'In de vergadering' : 'Op weg naar de vergadering';
  if (r.chatting) return `In gesprek met ${r.chatting.with.name.split(' ')[0]}`;
  if (r.seated) return 'Aan het werk aan het bureau';
  if (r.mode === 'work') return r.atWork ? 'Aan het werk' : 'Op weg naar het werk';
  return r.role === 'Director' ? 'Pauze in de tuin' : 'Wandelt door het dorp';
}
function personAt(wx, wy) {
  const H = personHeight();
  const list = [...residentsHere(), { ...state.kevin, id: 'kevin', name: KEVIN.name, role: 'Kevin', where: state.scene }];
  let best = null;
  for (const r of list) {
    const top = r.y - H * (r.seated ? 0.85 : 1.0);
    if (wx > r.x - H * 0.24 && wx < r.x + H * 0.24 && wy > top && wy < r.y + H * 0.04) {
      if (!best || r.y > best.y) best = r;
    }
  }
  return best;
}
canvas.addEventListener('pointermove', (e) => {
  if (!hoverCard) return;
  const [wx, wy] = screenToWorld(e.offsetX, e.offsetY);
  const r = editor.on ? null : personAt(wx, wy);
  if (!r) { hoverCard.hidden = true; canvas.style.cursor = ''; return; }
  const isKevin = r.role === 'Kevin';
  hoverCard.innerHTML = '';
  const add = (cls, text) => { const el = document.createElement('div'); el.className = cls; el.textContent = text; hoverCard.appendChild(el); return el; };
  add('hc-name' + (r.role === 'Worker' ? ' worker' : ''), r.name);
  add('hc-role', isKevin ? 'Stafchef · Raadhuis' : roleLabel(r) + (r.role === 'Director' ? ' · ' + r.building.name : ''));
  add('hc-bio', isKevin ? KEVIN_BIO : r.bio);
  add('hc-reports', 'Rapporteert aan: ' + (isKevin ? 'Harm (Chief Human Officer)' : reportsTo(r)));
  if (!isKevin) {
    add('hc-status', 'Nu: ' + statusLine(r));
    const real = residents.find((x) => x.id === r.id);
    if (real && real.notes.length) add('hc-notes', `Notities vandaag: ${real.notes.length} · laatste: ${real.notes[real.notes.length - 1]}`);
  }
  hoverCard.hidden = false;
  const pad = 14, cw = hoverCard.offsetWidth, ch = hoverCard.offsetHeight;
  let left = e.clientX + pad, top = e.clientY + pad;
  if (left + cw > window.innerWidth - 8) left = e.clientX - cw - pad;
  if (top + ch > window.innerHeight - 8) top = e.clientY - ch - pad;
  hoverCard.style.left = Math.max(8, left) + 'px';
  hoverCard.style.top = Math.max(8, top) + 'px';
});
canvas.addEventListener('pointerleave', () => { if (hoverCard) hoverCard.hidden = true; });

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
    row.innerHTML = `<span class="role ${r.role === 'Worker' ? 'worker' : ''}">${r.role === 'Worker' ? 'Stagiair · ' + r.building.name : 'Directeur · ' + r.building.job}</span>`;
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
  if (!db) { status.textContent = 'Naam voorlopig aangepast. Opslaan werkt alleen op de claude.ai-pagina.'; return; }
  const names = {};
  for (const r of residents) names[r.id] = r.name;
  try {
    await db.doc('settings/names').set({ names, savedAt: new Date().toISOString() });
    status.textContent = 'Namen opgeslagen ✓';
  } catch (err) {
    status.textContent = 'De namen konden nu niet worden opgeslagen.';
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
// Wait for the pictures AND every script on the page (see allScriptsRun in village.js).
Promise.all([loading, allScriptsRun]).then(() => {
  for (const r of residents) placeAtStart(r);
  loadChatLog();
});
