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
  if (s.dir === 'right') return [x - 64, y + 20, 'right'];
  if (s.dir === 'left') return [x + 64, y + 20, 'left'];
  if (s.dir === 'up') return [x + 66, y + 80, 'up'];
  return [x - 62, y + 44, 'right'];
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
  if (s.table) {                           // below the hands, whatever is over the table is under it
    g.save();
    g.beginPath();
    g.rect(left, y - H * 0.42, w, h);
    g.clip();
    cut(MEETING.table);
    g.restore();
  }
  if (s.chairBack) cut(MEETING.bottomChairBack);
  ctx.drawImage(seatCanvas, left, top, w, h);
}

// What drawRoom draws for the people while a meeting is on, back to front.
function meetingThings() {
  const things = [];
  for (const s of MEETING.seats) {
    if (!meetingPerson(s.who)) continue;
    things.push({ y: feetAt(s)[1], draw: () => drawSeated(s.who, s) });
  }
  for (const r of residents) if (r.role === 'Worker' && r.where === MEETING.room) things.push({ y: r.y, draw: () => drawResidentInPlace(r) });
  return things;
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
      const who = meetingPerson(s.who);
      if (!who) continue;
      [who.x, who.y] = feetAt(s);
      who.dir = s.dir; who.moving = false; who.step = 0; who.seat = s;
      if (who.role) { who.where = MEETING.room; who.leaving = false; who.target = null; who.trail = []; }
    }
    for (const r of residents) {
      if (r.role !== 'Worker') continue;
      r.where = MEETING.room; r.moving = false; r.step = 0;
      if (r.boss.seat) [r.x, r.y, r.dir] = standBehind(r.boss.seat);
    }
    state.camera.zoom = fitZoom() * state.zoomFactor.room;
    state.camera.x = ROOM_W / 2;
    state.camera.y = ROOM_H / 2;
    audio.setIndoors(true);
    setPlace('Council Hall', 'Meeting in progress');
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
    for (const r of residents) {
      if (r.role !== 'Director') continue;
      delete r.seat;
      r.where = 'map'; r.leaving = false; r.target = null; r.trail = []; r.wait = 1 + Math.random() * 2;
      placeAtHome(r);                        // somewhere in their own yard
      const w = r.workerRef;
      w.where = 'map'; w.x = r.x + 24; w.y = r.y + 18; w.dir = 'down';
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

const meetingBtn = document.getElementById('meeting');
function setMeetingButton() {
  meetingBtn.textContent = state.meeting ? 'End meeting' : 'Call meeting';
  meetingBtn.setAttribute('aria-pressed', String(state.meeting));
}
meetingBtn.addEventListener('click', () => { (state.meeting ? endMeeting : startMeeting)(); canvas.focus(); });

// ---------- who's on a call ----------

// Everyone who can be on a call. Kevin is the only one who makes calls for now (key C).
function peopleOnCall() {
  const list = [];
  if (kevinOnCall()) list.push({ id: 'kevin', name: KEVIN.name, job: KEVIN.job });
  return list;
}

const callPanel = document.getElementById('call');
let callShown = '';
function updateCallPanel() {
  const people = peopleOnCall();
  const key = people.map((p) => p.id + ':' + p.name).join('|');
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
    text.innerHTML = `<div class="caller-name"></div><div class="caller-status">On a call · ${p.job}</div>`;
    text.firstChild.textContent = p.name;
    card.append(face, text);
    callPanel.appendChild(card);
  }
}
setInterval(updateCallPanel, 200);

loadImage(HARM_SEATED.image, HARM_SEATED.src);
loadImage(KEVIN_SEATED.image, KEVIN_SEATED.src);
for (const r of residents) if (r.role === 'Director') loadImage('seat:' + r.id, `assets/characters/${r.id}-seated.png`);
