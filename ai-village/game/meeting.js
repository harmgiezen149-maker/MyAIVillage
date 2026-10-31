// Meetings in the Council Hall, and the face portrait of whoever is on a call.
// "Call meeting" takes everyone to the Council Hall: Harm at the head of the table, Kevin at Harm's right hand,
// each director on their own chair (MEETING in world.js), each worker standing behind their director.
// "End meeting" sends the directors and workers back to their yards and puts Harm and Kevin in front of the hall.

const SEAT_FRAME = { down: 0, right: 1, left: 2, up: 3 };   // order of the frames in a *-seated.png strip
// From the seat point to the feet, in person heights (the feet rest on the floor in front of the chair).
const SEAT_TO_FEET = { down: [0, 0.4], right: [0.25, 0.27], left: [-0.25, 0.27], up: [0, 0.19] };
const SEATED_FRAME = { w: 192, h: 256, foot: 244, figure: 236 };

state.meeting = false;
const seatCanvas = document.createElement('canvas');

function meetingPerson(id) {
  if (id === 'harm') return state.player;
  if (id === 'kevin') return state.kevin;
  return residents.find((r) => r.id === id);
}

function feetAt(s) {
  const H = personHeight(), [ax, ay] = SEAT_TO_FEET[s.dir];
  return [s.seat[0] + ax * H, s.seat[1] + ay * H];
}

// Workers stand just behind their director's chair, looking at the table.
function standBehind(s) {
  const [x, y] = s.seat;
  if (s.dir === 'right') return [x - 120, y + 30, 'right'];    // a step back from the chairs, leaving the aisle free
  if (s.dir === 'left') return [x + 120, y + 30, 'left'];
  if (s.dir === 'up') return [x + 90, y + 100, 'up'];
  return [x - 90, y + 70, 'right'];
}

// A seated person, with the table hiding their legs (or the chair back hiding their back).
function drawSeated(id, s) {
  const img = images['seat:' + id];
  const who = meetingPerson(id);
  if (!img) {                              // no seated pose yet: stand by the chair
    const S = id === 'harm' ? WALK_SHEET : id === 'kevin' ? KEVIN_SHEET : who.sheet;
    drawWalker(ctx, who, S);
    return;
  }
  const F = SEATED_FRAME, H = personHeight(), scale = H / F.figure;
  const [x, y] = feetAt(s);
  const w = F.w * scale, h = F.h * scale, left = x - w / 2, top = y - F.foot * scale;
  const k = (window.devicePixelRatio || 1) * state.camera.zoom;
  seatCanvas.width = Math.ceil(w * k);
  seatCanvas.height = Math.ceil(h * k);
  const g = seatCanvas.getContext('2d');
  g.setTransform(k, 0, 0, k, -left * k, -top * k);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, SEAT_FRAME[s.dir] * F.w, 0, F.w, F.h, left, top, w, h);
  g.globalCompositeOperation = 'destination-out';
  const cut = (poly) => { g.beginPath(); poly.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); };
  const tablePoly = s.cut || (s.table ? MEETING.table : null);   // a desk at home, or the council table
  if (tablePoly) {                         // below the hands, whatever is over the table is under it
    g.save();
    g.beginPath();
    g.rect(left, y - H * 0.42, w, h);
    g.clip();
    cut(tablePoly);
    g.restore();
  }
  if (s.chairBack) cut(MEETING.bottomChairBack);
  ctx.drawImage(seatCanvas, left, top, w, h);
}

// What drawRoom draws for the people while a meeting is on, back to front: Harm and Kevin seated,
// everyone else as they are (walking in, seated, or standing behind their director).
function meetingThings() {
  const things = [];
  for (const s of MEETING.seats) {
    if (s.who !== 'harm' && s.who !== 'kevin') continue;
    things.push({ y: feetAt(s)[1], draw: () => drawSeated(s.who, s) });
  }
  for (const r of residents) if (r.where === MEETING.room) things.push({ y: r.y, draw: () => drawResidentInPlace(r) });
  return things;
}

// Everyone walks to the Council Hall (through the door) and takes their seat; workers stand behind their director.
function callResidents() {
  for (const r of residents) {
    r.inMeeting = true;
    r.chatting = null;
    r.atWork = false;
    standUp(r);
    r.plan = null; r.path = null;
    if (r.role === 'Director') {
      const s = MEETING.seats.find((x) => x.who === r.id);
      if (!s) continue;
      const H = heightIn(MEETING.room), off = SEAT_TO_FEET[s.dir];
      const near = nearestOpenPoint(MEETING.room, s.seat[0] + off[0] * H, s.seat[1] + off[1] * H) || roomInside(MEETING.room);
      planTo(r, MEETING.room, near, () => sitAt(r, s)); r.plan.exact = true;
    } else {
      const s = MEETING.seats.find((x) => x.who === r.boss.id);
      if (!s) continue;
      const [bx, by, dir] = standBehind(s);
      const spot = nearestOpenPoint(MEETING.room, bx, by) || roomInside(MEETING.room);
      planTo(r, MEETING.room, spot, () => { r.dir = dir; }); r.plan.exact = true;
    }
  }
}

function startMeeting() {
  if (state.meeting || state.fade > 0) return;
  toast('Everyone to the Council Hall.');
  transition(() => {
    state.meeting = true;
    state.scene = MEETING.room;
    state.building = BUILDINGS.find((b) => b.room === MEETING.room);
    state.target = null;
    state.trail = [];
    for (const s of MEETING.seats) {
      if (s.who !== 'harm' && s.who !== 'kevin') continue;
      const who = meetingPerson(s.who);
      [who.x, who.y] = feetAt(s);
      who.dir = s.dir; who.moving = false; who.seat = s;
    }
    callResidents();
    state.camera.zoom = fitZoom() * state.zoomFactor.room;
    state.camera.x = ROOM_W / 2;
    state.camera.y = ROOM_H / 2;
    audio.setIndoors(true);
    setPlace('Council Hall', 'Meeting · everyone is walking over');
    setMeetingButton();
  });
}

function endMeeting() {
  if (!state.meeting || state.fade > 0) return;
  transition(() => {
    state.meeting = false;
    state.scene = 'map';
    state.building = null;
    state.target = null;
    state.doorArmed = false;                // don't walk straight back in
    const p = state.player, k = state.kevin;
    [p.x, p.y] = MEETING.after.harm; p.dir = 'down';
    [k.x, k.y] = MEETING.after.kevin; k.dir = 'down';
    state.trail = [];
    delete p.seat; delete k.seat;
    for (const r of residents) {           // stand up and walk back out: directors to their yards, workers into town
      r.inMeeting = false;
      if (r.task) { startMode(r, 'work'); goWork(r); r.modeUntil = Infinity; }   // still on a task: back to the desk
      else startMode(r, 'free');
    }
    state.camera.zoom = fitZoom() * state.zoomFactor.map;
    state.camera.x = p.x;
    state.camera.y = p.y;
    audio.setIndoors(false);
    setPlace('My AI Village', 'Town square');
    setMeetingButton();
  });
}

// During a meeting the name tag follows the mouse instead of Harm (Harm is sitting still).
canvas.addEventListener('pointermove', (e) => { state.pointer = screenToWorld(e.offsetX, e.offsetY); });
canvas.addEventListener('pointerleave', () => { state.pointer = null; });

// Once everyone has arrived, the meeting is in progress.
setInterval(() => {
  if (state.meeting && placeJob.textContent.includes('walking') && residents.every((r) => !r.plan)) setPlace('Council Hall', 'Meeting in progress');
}, 500);

const meetingBtn = document.getElementById('meeting');
function setMeetingButton() {
  meetingBtn.textContent = state.meeting ? 'End meeting' : 'Call meeting';
  meetingBtn.setAttribute('aria-pressed', String(state.meeting));
}
meetingBtn.addEventListener('click', () => { (state.meeting ? endMeeting : startMeeting)(); canvas.focus(); });

// ---------- who's on a call ----------

// Everyone on a call: Kevin calling a director about a task, a director calling their worker, or Kevin on key C.
function peopleOnCall() {
  const list = [];
  const seen = new Set();
  const nameOf = (id) => (id === 'kevin' ? KEVIN.name : (residents.find((r) => r.id === id) || {}).name || id);
  const calls = typeof officeCallsNow === 'function' ? officeCallsNow() : [];
  for (const c of calls) {
    for (const [id, other] of [[c.a, c.b], [c.b, c.a]]) {
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id, name: nameOf(id), job: (id === c.a ? 'Calling ' : 'Talking to ') + nameOf(other).split(' ')[0] });
    }
  }
  if (kevinOnCall() && !seen.has('kevin')) list.push({ id: 'kevin', name: KEVIN.name, job: 'On a call · ' + KEVIN.job });
  return list;
}

const callPanel = document.getElementById('call');
let callShown = '';
function updateCallPanel() {
  const people = peopleOnCall();
  const key = people.map((p) => p.id + ':' + p.name + ':' + p.job).join('|');
  if (key === callShown) return;
  callShown = key;
  callPanel.innerHTML = '';
  callPanel.hidden = !people.length;
  for (const p of people) {
    const card = document.createElement('div');
    card.className = 'caller';
    const face = document.createElement('img');
    face.alt = '';
    face.src = `assets/portraits/${p.id}.jpg`;
    face.onerror = () => {                  // no portrait yet: show initials
      const init = document.createElement('div');
      init.className = 'initials';
      init.textContent = p.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
      face.replaceWith(init);
    };
    const text = document.createElement('div');
    text.innerHTML = '<div class="caller-name"></div><div class="caller-status"></div>';
    text.lastChild.textContent = p.job;
    text.firstChild.textContent = p.name;
    card.append(face, text);
    callPanel.appendChild(card);
  }
}
setInterval(updateCallPanel, 200);

loadImage(HARM_SEATED.image, HARM_SEATED.src);
loadImage(KEVIN_SEATED.image, KEVIN_SEATED.src);
for (const r of residents) if (r.role === 'Director') loadImage('seat:' + r.id, `assets/characters/${r.id}-seated.png`);
