// Walk to someone (Harm, 2026-11-03): "Ik wil op een afbeelding van een character kunnen klikken en dat ik dan naar
// dit character toe loop". Works from:
// - a figure in the village: Harm walks there, and the conversation opens on arrival;
// - the faces "aan de telefoon", the face in the conversation box, and the list "Wie is waar": Harm walks there.
// Also across doors: someone indoors means walking to their house and going in; Harm indoors walks out first.
// The person waits once Harm is close (heldByHarm in talk.js), so they don't walk away at the last moment.

const visit = { id: null, talk: false, until: 0, aim: null, leg: '' };

function visitName(id) { return id === 'kevin' ? KEVIN.name : firstName(id); }

function walkTo(id, opts = {}) {
  if (id === 'kevin') {                                    // Kevin always walks along with Harm
    if (opts.talk) openKevin(); else toast(`${KEVIN.name} loopt al met je mee.`);
    return;
  }
  const r = residentById(id);
  if (!r) return;
  if (state.meeting) { toast('Je zit in de vergadering. Sluit die eerst om rond te lopen.'); return; }
  if (r.inMeeting) { toast(`${visitName(id)} zit in de vergadering in het Raadhuis.`); return; }
  state.target = null; state.route = null;
  Object.assign(visit, { id, talk: !!opts.talk, until: state.time + 90, aim: null, leg: '' });
  if (!opts.quiet) toast(`Je loopt naar ${visitName(id)}${r.where === state.scene ? '' : ' (' + placeOf(r) + ')'}.`);
  stepVisit();
}
function stopVisit() { visit.id = null; visit.aim = null; }

function placeOf(r) {
  if (r.inMeeting) return 'in de vergadering';
  if (r.where === 'map') return 'in het dorp';
  const b = BUILDINGS.find((x) => x.room === r.where);
  if (!b) return 'binnen';
  return (/^(Drukkerij|Geleerdentoren|Werkplaats|Praktijk)/.test(b.name) ? 'in de ' : 'in het ') + b.name;
}

function aimAt(point) {
  state.target = point;
  visit.aim = point;
}

function stepVisit() {
  if (!visit.id) return;
  const r = residentById(visit.id);
  if (!r || state.time > visit.until || state.meeting || r.inMeeting) { stopVisit(); return; }
  if (state.fade > 0) return;                                        // going through a door
  if (state.target && state.target !== visit.aim) { stopVisit(); return; }   // Harm clicked somewhere else
  const H = personHeight(), p = state.player;
  if (r.where === state.scene) {
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (d < H * 1.35 || (!state.target && visit.leg === 'near' && d < H * 2.6)) {   // there (or as close as the furniture lets you)
      state.target = null; state.route = null;
      p.dir = Math.abs(r.x - p.x) > Math.abs(r.y - p.y) ? (r.x > p.x ? 'right' : 'left') : (r.y > p.y ? 'down' : 'up');
      const id = visit.id, talk = visit.talk;
      stopVisit();
      if (talk) openChat(id); else toast(`Je bent bij ${visitName(id)}. Tik op ${visitName(id)} om te praten.`);
      return;
    }
    // follow: aim again when they have moved on, or when the last route ended short
    if (!state.target || visit.leg !== 'near' || !visit.aim || Math.hypot(visit.aim[0] - r.x, visit.aim[1] - r.y) > H * 0.5) {
      visit.leg = 'near';
      aimAt([r.x, r.y]);
    }
    return;
  }
  if (state.scene === 'map') {                                       // they are indoors: to their door, and in
    const b = BUILDINGS.find((x) => x.room === r.where);
    if (!b) { stopVisit(); return; }
    if (visit.leg !== 'door:' + b.id || !state.target) { visit.leg = 'door:' + b.id; state.doorArmed = true; aimAt(b.door.slice()); }
    return;
  }
  if (visit.leg !== 'out' || !state.target) { visit.leg = 'out'; aimAt(ROOMS[state.scene].exit.slice()); }   // Harm is indoors: out first
}
setInterval(stepVisit, 150);

// walking with the keys stops a visit
window.addEventListener('keydown', (e) => { if (visit.id && /^(Arrow|[wasdWASD]$)/.test(e.key) && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) stopVisit(); });

// ---------- the faces "aan de telefoon" and the face in the conversation box ----------
document.getElementById('call').addEventListener('click', (e) => {
  const card = e.target.closest('.caller[data-id]');
  if (card) { walkTo(card.dataset.id); canvas.focus(); }
});
document.getElementById('chat-face').addEventListener('click', () => { if (office.chat) walkTo(office.chat.id, { talk: false }); });

// ---------- "Wie is waar": everyone, where they are, tap to walk there ----------
function renderPeople() {
  const ul = document.getElementById('people-list');
  const rows = [{ id: 'kevin', name: KEVIN.name, sub: 'Stafchef', where: 'loopt met je mee' }]
    .concat(residents.map((r) => ({ id: r.id, name: r.name, sub: r.role === 'Director' ? r.building.job : 'stagiair van ' + r.boss.name.split(' ')[0], where: placeOf(r) })));
  ul.innerHTML = rows.map((x) => `<li><button class="people-row" data-id="${esc(x.id)}" aria-label="Loop naar ${esc(x.name)}">
      <img src="assets/portraits/${esc(x.id)}.jpg" alt="" onerror="this.style.visibility='hidden'">
      <span class="people-txt"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span><span class="people-where">${esc(x.where)}</span></button></li>`).join('');
}
function togglePeople(open) {
  const panel = document.getElementById('people');
  const show = open === undefined ? panel.hidden : open;
  panel.hidden = !show;
  document.getElementById('people-btn').setAttribute('aria-pressed', String(show));
  if (show) {                                                         // same corner as the to-do list and Over mij: one at a time
    if (!document.getElementById('todo').hidden) document.getElementById('todo-close').click();
    if (!document.getElementById('profile').hidden) closeProfile();
  }
  if (show) { renderPeople(); clearInterval(togglePeople.timer); togglePeople.timer = setInterval(() => { if (!panel.hidden) renderPeople(); }, 3000); }
  else { clearInterval(togglePeople.timer); canvas.focus(); }
}
document.getElementById('people-btn').addEventListener('click', () => togglePeople());
document.getElementById('people-close').addEventListener('click', () => togglePeople(false));
document.getElementById('people-list').addEventListener('click', (e) => {
  const b = e.target.closest('.people-row[data-id]');
  if (!b) return;
  if (window.matchMedia('(max-width: 700px)').matches) togglePeople(false);   // on a phone: out of the way, so Harm sees the walk
  walkTo(b.dataset.id);
  canvas.focus();                                                     // the arrow keys steer Harm again
});
document.getElementById('people').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') togglePeople(false); });
for (const id of ['todo-btn', 'profile-btn']) document.getElementById(id).addEventListener('click', () => { if (!document.getElementById('people').hidden) togglePeople(false); });
