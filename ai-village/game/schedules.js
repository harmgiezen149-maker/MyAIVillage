// Recurring tasks (Harm, 2026-11-03): "kan ik directeuren ook een terugkerende taak geven, bijvoorbeeld dat ze elke
// dag op een bepaald moment mijn agenda en mail bekijken en een update geven en advies". Harm chose: it must also run
// when the village is closed, and Harm makes, plans and stops these tasks per director, with time and days per task.
//
// How it works:
// - The village keeps the plans in its own database: schedules/<id> = { owner, text, time "HH:MM", days [1..7]
//   (1 = maandag), active, lastRunDay }.
// - A scheduled task of Claude in the cloud (on Harm's own Claude plan, see agents/terugkerende-taken.md) looks every
//   hour whether a plan is due, does the work with Harm's Gmail and Calendar, and writes the answer as a task in this
//   database. Drafts go to Gmail (never sent); calendar items wait for Harm's Approve here, as always.
// - While the village is open, it picks up those answers by itself and the director tells Harm in the chat.

const DAY_NAMES = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const plans = { list: new Map(), editing: null };

function daysText(days) {
  const d = [...(days || [])].sort();
  if (d.length === 7) return 'elke dag';
  if (d.join() === '1,2,3,4,5') return 'werkdagen';
  if (d.join() === '6,7') return 'weekend';
  return d.map((x) => DAY_NAMES[x - 1]).join(' ');
}

async function savePlan(p) {
  p.updatedAt = nowStamp();
  plans.list.set(p.id, p);
  renderPlans();
  if (office.db) await office.db.doc('schedules/' + p.id).set(JSON.parse(JSON.stringify(p))).catch(() => toast('Opslaan in het dorp lukte niet.'));
}
async function deletePlan(id) {
  plans.list.delete(id);
  renderPlans();
  if (office.db) await office.db.doc('schedules/' + id).delete().catch(() => {});
}

function renderPlans() {
  const ul = document.getElementById('plan-list');
  if (!ul) return;
  const list = [...plans.list.values()].sort((a, b) => a.time.localeCompare(b.time));
  if (!list.length) { ul.innerHTML = '<li class="todo-empty">Nog geen terugkerende taken. Maak er hierboven een.</li>'; return; }
  ul.innerHTML = list.map((p) => `<li class="plan ${p.active ? '' : 'off'}">
      <div class="plan-top"><img src="assets/portraits/${esc(p.owner)}.jpg" alt=""><div><b>${esc(firstName(p.owner))}</b> · ${esc(p.time)} · ${esc(daysText(p.days))}${p.active ? '' : ' · <i>gepauzeerd</i>'}
      <div class="plan-text">${esc(p.text)}</div>
      ${p.lastRunDay ? `<div class="todo-meta" style="margin:0">Laatst gedaan: ${esc(new Date(p.lastRunDay + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }))}</div>` : ''}</div></div>
      <div class="plan-btns">
        <button class="small" data-act="toggle" data-id="${esc(p.id)}">${p.active ? 'Pauzeren' : 'Hervatten'}</button>
        <button class="small" data-act="edit" data-id="${esc(p.id)}">Bewerken</button>
        <button class="small" data-act="now" data-id="${esc(p.id)}" title="Nu één keer laten doen, in het dorp">Nu doen</button>
        <button class="small" data-act="del" data-id="${esc(p.id)}" aria-label="Verwijderen">🗑</button>
      </div></li>`).join('');
}

function fillForm(p) {
  plans.editing = p ? p.id : null;
  document.getElementById('plan-owner').value = p ? p.owner : (document.getElementById('plan-owner').value || DIRECTORS[0].id);
  document.getElementById('plan-text').value = p ? p.text : '';
  document.getElementById('plan-time').value = p ? p.time : '08:00';
  const days = new Set(p ? p.days : [1, 2, 3, 4, 5]);
  for (const b of document.querySelectorAll('#plan-days [data-day]')) b.setAttribute('aria-pressed', String(days.has(Number(b.dataset.day))));
  document.getElementById('plan-save').textContent = p ? 'Wijziging opslaan' : 'Inplannen';
  document.getElementById('plan-cancel').hidden = !p;
}
function formDays() { return [...document.querySelectorAll('#plan-days [data-day][aria-pressed="true"]')].map((b) => Number(b.dataset.day)); }

function openPlans(ownerId) {
  const panel = document.getElementById('plans');
  if (!document.getElementById('todo').hidden) document.getElementById('todo-close').click();   // same corner
  panel.hidden = false;
  fillForm(null);
  if (ownerId && ownerId !== 'kevin') document.getElementById('plan-owner').value = DIRECTORS.some((d) => d.id === ownerId) ? ownerId : residentById(ownerId).boss.id;
  renderPlans();
  focusTyping(document.getElementById('plan-text'));
}
function closePlans() { document.getElementById('plans').hidden = true; canvas.focus(); }

// ---------- wiring ----------

document.getElementById('plan-owner').innerHTML = DIRECTORS.map((d) => { const r = residentById(d.id); return `<option value="${esc(d.id)}">${esc(r.name)} · ${esc(r.building.job)}</option>`; }).join('');
document.getElementById('plan-days').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.day) { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); return; }
  const set = b.dataset.preset === 'all' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  for (const x of document.querySelectorAll('#plan-days [data-day]')) x.setAttribute('aria-pressed', String(set.includes(Number(x.dataset.day))));
});
document.getElementById('plan-save').addEventListener('click', async () => {
  const text = document.getElementById('plan-text').value.trim(), time = document.getElementById('plan-time').value, days = formDays();
  if (!text) { toast('Schrijf eerst wat de directeur moet doen.'); return; }
  if (!/^\d\d:\d\d$/.test(time)) { toast('Kies een tijd.'); return; }
  if (!days.length) { toast('Kies minstens één dag.'); return; }
  const old = plans.editing && plans.list.get(plans.editing);
  const p = old ? { ...old, owner: document.getElementById('plan-owner').value, text, time, days } :
    { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), owner: document.getElementById('plan-owner').value, text, time, days, active: true, createdAt: nowStamp(), lastRunDay: '' };
  await savePlan(p);
  toast(old ? 'Gewijzigd.' : `Ingepland: ${firstName(p.owner)}, ${p.time}, ${daysText(p.days)}.`);
  fillForm(null);
});
document.getElementById('plan-cancel').addEventListener('click', () => fillForm(null));
document.getElementById('plan-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const p = plans.list.get(b.dataset.id);
  if (!p) return;
  if (b.dataset.act === 'toggle') { p.active = !p.active; await savePlan(p); toast(p.active ? 'Hervat.' : 'Gepauzeerd: deze taak wordt niet meer gedaan tot je op Hervatten drukt.'); }
  if (b.dataset.act === 'edit') { fillForm(p); focusTyping(document.getElementById('plan-text')); }
  if (b.dataset.act === 'now') { createTask(p.text, 'todo', { owner: p.owner, brief: `Terugkerende taak van Harm (${p.time}, ${daysText(p.days)}), nu één keer met de hand gestart.` }); toast(`${firstName(p.owner)} gaat ermee aan de slag.`); }
  if (b.dataset.act === 'del') {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Echt?'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = '🗑'; } }, 4000); return; }
    await deletePlan(p.id); toast('Verwijderd.');
  }
});
document.getElementById('plans-btn').addEventListener('click', () => openPlans());
document.getElementById('plans-close').addEventListener('click', closePlans);
document.getElementById('plans').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') closePlans(); });
document.getElementById('chat-plan').addEventListener('click', () => { if (office.chat) openPlans(office.chat.id); });
document.getElementById('todo-btn').addEventListener('click', () => { if (!document.getElementById('plans').hidden) closePlans(); });

// ---------- answers from the cloud: pick them up while the village is open ----------

async function announceNew(t) {
  if (t.from !== 'schedule' || t.announced) return;
  t.announced = true;
  await saveTask(t);
  if (typeof postResult === 'function') postResult(t);
}
async function pickUpNew() {
  if (!office.db || !office.ready) return;
  try {
    const snap = await office.db.collection('tasks').orderBy('createdAt', 'desc').limit(15).get();
    for (const d of snap.docs) {
      const t = JSON.parse(JSON.stringify(d.data()));
      if (!t || !t.id) continue;
      const known = office.tasks.get(t.id);
      if (!known) { office.tasks.set(t.id, t); renderTodo(); }
      announceNew(office.tasks.get(t.id));
    }
  } catch (e) { /* try again next time */ }
}

(async () => {
  await allScriptsRun;
  const db = window.claude && window.claude.use ? await window.claude.use('db').catch(() => null) : null;
  if (db) {
    try {
      const snap = await db.collection('schedules').get();
      for (const d of snap.docs) { const p = JSON.parse(JSON.stringify(d.data() || {})); if (p.id) plans.list.set(p.id, p); }
    } catch (e) { /* none yet */ }
  }
  renderPlans();
  // answers that came in while the village was closed
  const wait = setInterval(() => { if (office.ready) { clearInterval(wait); for (const t of office.tasks.values()) announceNew(t); } }, 500);
  setInterval(pickUpNew, 60000);
})();
