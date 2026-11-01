// Memory (verbeterplan D1, Harm 2026-11-01): every director keeps a short dossier of the tasks they did for Harm and
// what Harm thought of the answer (👍/👎), and Harm can write a short profile about themself. Both go into the
// prompts, so the team learns what Harm likes and does not start from zero every time.
//
// Stored in the page's own database (owner only): memory/<personId> and settings/profile.
// Nothing here calls Claude by itself.

const memory = { profile: '', dossiers: {}, loaded: false };
const DOSSIER_SIZE = 12;

function dossierOf(id) { return memory.dossiers[id] || (memory.dossiers[id] = { items: [] }); }

function saveDossier(id) {
  const d = dossierOf(id);
  d.items = d.items.slice(-DOSSIER_SIZE);
  if (office.db) office.db.doc('memory/' + id).set({ id, items: d.items, updatedAt: nowStamp() }).catch(() => {});
}

// A finished task goes into the dossier of whoever did it (and Kevin's, so Kevin knows who did what).
function rememberTask(t) {
  try { addToDossiers(t); } catch (e) { console.warn('Kon de taak niet onthouden:', e); }   // memory must never stop a task
}
function addToDossiers(t) {
  if (!t || !t.owner && !t.subtasks) return;
  const item = { at: nowStamp(), taskId: t.id, task: String(t.text || '').slice(0, 200), summary: String(t.summary || '').slice(0, 400), outcome: t.outcome || 'done' };
  const who = t.subtasks ? [] : [t.owner];
  if (!t.parentId) who.push('kevin');
  for (const id of who) {
    const d = dossierOf(id);
    if (d.items.some((x) => x.taskId === t.id)) continue;
    d.items.push({ ...item, ...(id === 'kevin' && t.owner ? { by: t.owner } : {}) });
    saveDossier(id);
  }
}

// Harm's 👍/👎 on an answer: kept on the task and in the dossiers of everyone who worked on it.
async function giveFeedback(taskId, good, comment) {
  const t = office.tasks.get(taskId);
  if (!t) return;
  t.feedback = { good: !!good, comment: String(comment || '').slice(0, 300), at: nowStamp() };
  logStep(t, 'harm', `Harm vond het antwoord ${good ? 'goed 👍' : 'niet goed 👎'}${comment ? ': ' + comment : ''}.`);
  await saveTask(t);
  const people = new Set(['kevin']);
  if (t.owner) people.add(t.owner);
  for (const id of t.subtasks || []) { const s = office.tasks.get(id); if (s && s.owner) people.add(s.owner); }
  for (const id of people) {
    const d = dossierOf(id);
    let item = d.items.find((x) => x.taskId === taskId);
    if (!item) { item = { at: nowStamp(), taskId, task: String(t.text || '').slice(0, 200), summary: String(t.summary || '').slice(0, 400) }; d.items.push(item); }
    item.feedback = good ? 'good' : 'bad';
    if (comment) item.comment = String(comment).slice(0, 300);
    saveDossier(id);
  }
  toast(good ? 'Dank je, dat onthouden ze.' : 'Genoteerd: ze letten er de volgende keer op.');
}

// The text that goes into a prompt.
function profileText() {
  return memory.profile.trim() ? `ABOUT HARM (Harm wrote this; use it, don't repeat it back):\n${memory.profile.trim().slice(0, 1500)}\n` : '';
}
function memoryText(id) {
  const items = dossierOf(id).items.slice(-8);
  if (!items.length) return profileText();
  const lines = items.map((x) => `- ${String(x.at).slice(0, 10)}: "${x.task}"${x.by ? ` (done by ${firstName(x.by)})` : ''} → ${x.summary || '(no summary)'}${x.feedback ? ` [Harm: ${x.feedback === 'good' ? 'good' : 'NOT good'}${x.comment ? ' — ' + x.comment : ''}]` : ''}`);
  return `${profileText()}WHAT YOU REMEMBER from earlier tasks for Harm (newest last). Learn from Harm's feedback; do the same thing better, not again from scratch:\n${lines.join('\n')}\n`;
}

// ---------- the profile panel ("Over mij" in the toolbar / Meer menu) ----------

function openProfile() {
  const panel = document.getElementById('profile');
  const box = document.getElementById('profile-text');
  box.value = memory.profile;
  if (!document.getElementById('todo').hidden) document.getElementById('todo-close').click();   // same corner: one at a time
  panel.hidden = false;
  document.getElementById('profile-btn').setAttribute('aria-pressed', 'true');
  box.focus();
}
function closeProfile() {
  document.getElementById('profile').hidden = true;
  document.getElementById('profile-btn').setAttribute('aria-pressed', 'false');
  canvas.focus();
}
async function saveProfile() {
  memory.profile = document.getElementById('profile-text').value.slice(0, 1500);
  try { localStorage.setItem('village-profile', memory.profile); } catch (e) { /* fine */ }
  const status = document.getElementById('profile-status');
  if (office.db) {
    try { await office.db.doc('settings/profile').set({ text: memory.profile, updatedAt: nowStamp() }); status.textContent = 'Opgeslagen. Kevin en het team lezen dit bij elke taak.'; }
    catch (e) { status.textContent = 'Alleen op dit apparaat opgeslagen (de database deed het niet).'; }
  } else status.textContent = 'Opgeslagen op dit apparaat.';
}
function renderDossierList() {
  const el = document.getElementById('profile-dossiers');
  const rows = DIRECTORS.map((d) => {
    const items = dossierOf(d.id).items;
    const good = items.filter((x) => x.feedback === 'good').length, bad = items.filter((x) => x.feedback === 'bad').length;
    return `<li><b>${esc(firstName(d.id))}</b>: ${items.length} ${items.length === 1 ? 'taak' : 'taken'} onthouden${good || bad ? ` · ${good}👍 ${bad}👎` : ''}</li>`;
  });
  el.innerHTML = rows.join('');
}

document.getElementById('profile-btn').addEventListener('click', () => {
  if (document.getElementById('profile').hidden) { openProfile(); renderDossierList(); } else closeProfile();
});
document.getElementById('profile-close').addEventListener('click', closeProfile);
document.getElementById('profile-save').addEventListener('click', saveProfile);
document.getElementById('profile-text').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') closeProfile(); });
document.getElementById('profile-forget').addEventListener('click', async () => {
  const b = document.getElementById('profile-forget');
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Zeker weten? Klik nog eens'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Geheugen van het team wissen'; }, 4000); return; }
  b.dataset.sure = ''; b.textContent = 'Geheugen van het team wissen';
  for (const id of Object.keys(memory.dossiers)) { memory.dossiers[id] = { items: [] }; if (office.db) office.db.doc('memory/' + id).delete().catch(() => {}); }
  renderDossierList();
  document.getElementById('profile-status').textContent = 'Het geheugen van het team is gewist. Je profiel staat er nog.';
});

// 👍/👎 under an answer (chat and meeting). Thumbs down asks "what could be better?" in a small box.
function feedbackRow(taskId) {
  const t = office.tasks.get(taskId);
  const row = document.createElement('div');
  row.className = 'feedback';
  if (t && t.feedback) { row.textContent = t.feedback.good ? '👍 Je vond dit goed' : `👎 Genoteerd${t.feedback.comment ? ': ' + t.feedback.comment : ''}`; return row; }
  const up = document.createElement('button'), down = document.createElement('button');
  up.className = down.className = 'small fb';
  up.textContent = '👍'; up.title = 'Goed antwoord'; up.setAttribute('aria-label', 'Goed antwoord');
  down.textContent = '👎'; down.title = 'Kan beter'; down.setAttribute('aria-label', 'Kan beter');
  up.onclick = () => { giveFeedback(taskId, true).then(rerenderAnswers); };
  down.onclick = () => {
    row.innerHTML = '';
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Wat kan beter? (mag leeg)'; input.setAttribute('aria-label', 'Wat kan beter?');
    const ok = document.createElement('button'); ok.className = 'small'; ok.textContent = 'Opslaan';
    const send = () => giveFeedback(taskId, false, input.value.trim()).then(rerenderAnswers);
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); });
    ok.onclick = send;
    row.append(input, ok);
    input.focus();
  };
  row.append(up, down);
  return row;
}
function rerenderAnswers() {
  if (typeof renderChat === 'function') renderChat();
  if (typeof renderMeeting === 'function' && talk && talk.dock && talk.dock.open) renderMeeting();
}

(async () => {
  try { memory.profile = localStorage.getItem('village-profile') || ''; } catch (e) { /* fine */ }
  const db = window.claude && window.claude.use ? await window.claude.use('db').catch(() => null) : null;
  if (db) {
    try {
      const p = await db.doc('settings/profile').get();
      if (p.exists && typeof p.data().text === 'string') memory.profile = p.data().text;
      const snap = await db.collection('memory').get();
      // what the database gives back is read-only: keep our own copy (Harm hit "object is not extensible", 2026-11-01)
      for (const d of snap.docs) { const x = JSON.parse(JSON.stringify(d.data() || {})); const id = x.id || d.id; if (id) memory.dossiers[id] = { items: Array.isArray(x.items) ? x.items : [] }; }
    } catch (e) { /* start with an empty memory */ }
  }
  memory.loaded = true;
})();
