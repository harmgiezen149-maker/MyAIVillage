// The to-do panel (split out of office.js, verbeterplan F3): the list, parts of a question under it, approvals,
// the archive, search, delete, Alles hervatten and the ☀️ Briefing button. Loaded after office.js and tools.js.

// ---------- the to-do panel ----------

function taskCalls(t) {
  return (t.calls || 0) + (t.subtasks || []).reduce((n, id) => n + ((office.tasks.get(id) || {}).calls || 0), 0);
}

function statusText(t) {
  if (t.status === 'split') {
    const subs = (t.subtasks || []).map((id) => office.tasks.get(id)).filter(Boolean);
    return `Kevin verzamelt de antwoorden (${subs.filter((x) => x.status === 'done').length}/${(t.subtasks || []).length} klaar)`;
  }
  const who = t.owner ? firstName(t.owner) : 'Kevin';
  return ({ new: 'Nieuw', kevin: 'Kevin pakt het op', assigned: `Bij ${who}`, working: t.worker ? `${firstName(t.worker)} werkt eraan, ${who} controleert` : `${who} werkt eraan`,
    needs_harm: 'Wacht op jouw OK', finishing: 'Bijna klaar', done: 'Klaar', paused: 'Gepauzeerd' })[t.status] || t.status;
}

// Done tasks older than a week go into the archive (verbeterplan B6).
const ARCHIVE_DAYS = 7;
function isArchived(t) { return t.status === 'done' && t.doneAt && Date.now() - new Date(t.doneAt).getTime() > ARCHIVE_DAYS * 86400000; }
function matchesSearch(t, q) {
  if (!q) return true;
  const subs = (t.subtasks || []).map((id) => office.tasks.get(id)).filter(Boolean);
  return [t, ...subs].some((x) => `${x.text || ''} ${x.words || ''} ${x.summary || ''} ${x.owner ? firstName(x.owner) : ''}`.toLowerCase().includes(q));
}

function renderTodo() {
  const list = document.getElementById('todo-list');
  if (!list) return;
  // parts of a question to several directors are shown under that question, not as tasks of their own
  const all = [...office.tasks.values()].filter((t) => !t.parentId || !office.tasks.has(t.parentId))
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.createdAt.localeCompare(a.createdAt));
  const open = all.filter((t) => t.status !== 'done').length;
  const badge = document.getElementById('todo-count');
  badge.textContent = open ? String(open) : '';
  badge.hidden = !open;
  const anyPaused = [...office.tasks.values()].some((t) => t.status === 'paused' && !office.running.has(t.id));
  const resumeAll = document.getElementById('resume-all');
  if (resumeAll) resumeAll.hidden = !anyPaused;
  const searchEl = document.getElementById('todo-search');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const shown = all.filter((t) => matchesSearch(t, q));
  const tasks = shown.filter((t) => q || !isArchived(t));
  const archived = q ? [] : shown.filter(isArchived);
  list.innerHTML = '';
  office.reshow = null;
  if (!all.length) { list.innerHTML = '<li class="todo-empty">Nog niets. Typ hierboven een taak en druk op Enter: Kevin geeft hem aan de juiste directeur.</li>'; return; }
  if (!shown.length) { list.innerHTML = `<li class="todo-empty">Niets gevonden voor "${esc(q)}".</li>`; return; }
  for (const t of tasks) list.appendChild(taskItem(t));
  if (archived.length) {
    const li = document.createElement('li');
    li.className = 'todo-archive';
    const det = document.createElement('details');
    det.open = !!office.archiveOpen;
    det.addEventListener('toggle', () => { office.archiveOpen = det.open; });
    det.innerHTML = `<summary>Archief (${archived.length}) · klaar, ouder dan een week</summary>`;
    const ul = document.createElement('ul');
    for (const t of archived) ul.appendChild(taskItem(t));
    det.appendChild(ul);
    li.appendChild(det);
    list.appendChild(li);
  }
  if (office.reshow) office.reshow(); else hideDone();     // the list was redrawn under the mouse: keep the card on the same task, or hide it
}

function taskItem(t) {
    const li = document.createElement('li');
    li.className = 'todo-item ' + t.status;
    li.innerHTML = `<div class="todo-row"><span class="todo-check" aria-hidden="true">${t.status === 'done' ? '✓' : ''}</span>
      <span class="todo-text">${esc(t.text)}</span></div>
      <div class="todo-meta">${esc(statusText(t))}${t.from === 'chat' ? ` · persoonlijk gevraagd aan ${esc(firstName(t.askedPerson))}` : t.from === 'meeting' ? ` · in de vergadering gevraagd aan ${esc(firstName(t.askedPerson))}` : ''}${t.status === 'done' ? ' · ' + esc(doneWhen(t)) : ''}${taskCalls(t) ? ` · ${taskCalls(t)} ${taskCalls(t) === 1 ? 'aanroep' : 'aanroepen'}` : ''}</div>`;
    const subs = (t.subtasks || []).map((id) => office.tasks.get(id)).filter(Boolean);
    const last = (t.log || []).slice(-1)[0];
    if (t.status !== 'done' && t.status !== 'paused' && last) li.insertAdjacentHTML('beforeend', `<div class="todo-latest">${esc(last.text)}</div>`);
    if (t.status === 'paused') {
      li.insertAdjacentHTML('beforeend', `<div class="todo-latest">${esc(t.pauseReason || '')}</div>`);
      const b = document.createElement('button'); b.textContent = 'Verder'; b.className = 'small';
      b.onclick = () => resumeTask(t);
      li.appendChild(b);
    }
    if (subs.length && t.status !== 'done') {
      const parts = document.createElement('div');
      parts.className = 'todo-parts';
      for (const x of subs) {
        const row = document.createElement('div');
        row.className = 'todo-part ' + x.status;
        row.textContent = `${x.status === 'done' ? '✓' : '·'} ${firstName(x.owner)}: ${statusText(x)}`;
        if (x.status === 'paused') {
          const b = document.createElement('button'); b.textContent = 'Verder'; b.className = 'small';
          b.onclick = () => resumeTask(x);
          row.appendChild(b);
        }
        parts.appendChild(row);
      }
      li.appendChild(parts);
    }
    const sources = t.status === 'done' ? [t] : [t, ...subs];
    for (const [src, ap] of sources.flatMap((src) => (src.approvals || []).filter((a) => a.status === 'pending' || a.status === 'approving' || a.status === 'unsure').map((a) => [src, a]))) {
      const p = ap.payload;
      const box = document.createElement('div');
      box.className = 'todo-approval';
      box.innerHTML = `<div><b>${ap.kind === 'app' ? esc(ap.app) : ap.kind === 'create_event' ? 'In de agenda zetten' : 'Afspraak wijzigen'}:</b> ${esc(ap.kind === 'app' ? ap.what : (p.summary || ap.what || ''))}</div>
        <div class="todo-meta">${esc((p.startTime || '').replace('T', ' ').slice(0, 16))}${p.endTime ? ' – ' + esc(p.endTime.slice(11, 16)) : ''}${p.location ? ' · ' + esc(p.location) : ''}</div>`;
      const ok = document.createElement('button'); ok.textContent = ap.status === 'approving' ? 'Bezig…' : ap.status === 'unsure' ? 'Controleren en goedkeuren' : 'Goedkeuren'; ok.className = 'small primary'; ok.disabled = ap.status === 'approving';
      ok.onclick = () => decide(src.id, ap.id, true);
      const no = document.createElement('button'); no.textContent = 'Afwijzen'; no.className = 'small'; no.disabled = ap.status === 'approving';
      no.onclick = () => decide(src.id, ap.id, false);
      box.append(ok, no);
      li.appendChild(box);
    }
    if (t.status === 'done') {
      const b = document.createElement('button'); b.textContent = 'Rapport bekijken'; b.className = 'small';
      b.onclick = () => showReport(t);
      li.appendChild(b);
      li.addEventListener('mouseenter', () => showDone(t, li));
      li.addEventListener('mouseleave', hideDone);
      li.addEventListener('focusin', () => showDone(t, li));
      li.addEventListener('focusout', hideDone);
      li.tabIndex = 0;
    }
    if ((t.status === 'done' || t.status === 'paused' || t.status === 'needs_harm') && !office.running.has(t.id)) li.appendChild(deleteButton(t));
    if (t.id === office.hoverId && t.status === 'done') office.reshow = () => showDone(t, li);
    return li;
}

function doneWhen(t) {
  const d = new Date(t.doneAt);
  return d.toDateString() === new Date().toDateString() ? timeOf(t.doneAt) : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// ---------- ☀️ Briefing (verbeterplan D4) ----------
// One click: four directors each do a short part, Kevin bundles it into one answer with a top 3.
// Kevin's routing call is skipped (the parts are fixed), so it costs 4 directors + 1 bundling call.
const BRIEFING_PARTS = [
  ['post-house', "Today's agenda in ALL of Harm's calendars (with times, and which calendar), then the important unread mail of the last 24 hours (who, what, and whether Harm must act). Leave out newsletters and ads. No drafts unless something is urgent."],
  ['carriers-depot', 'Anything about travel, deliveries or being somewhere today and tomorrow (from the calendars and mail: departure times, parcels, places). Only if there is something; otherwise say so in one line.'],
  ['family-cottage', "What is on the week menu today and tomorrow in the Kookboek app, and whether anything is missing from the shopping list for it. Do not change anything."],
  ['criers-press', 'The 3 most important AI/tech news items of the last 24 hours (internet tool: news_search and hacker_news), each in one line with its source.'],
];
async function startBriefing() {
  const day = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const btn = document.getElementById('briefing-btn');
  const already = [...office.tasks.values()].find((t) => t.briefing === usageDay() && t.status !== 'done');
  if (already) { toast('De briefing van vandaag is al bezig.'); return; }
  if (btn.dataset.sure !== '1' && [...office.tasks.values()].some((t) => t.briefing === usageDay())) {
    btn.dataset.sure = '1'; btn.textContent = '☀️ Nog een keer?';
    setTimeout(() => { btn.dataset.sure = ''; btn.textContent = '☀️ Briefing'; }, 4000);
    return;
  }
  btn.dataset.sure = ''; btn.textContent = '☀️ Briefing';
  if (!office.sample) { toast('De briefing heeft Claude nodig: open het dorp op claude.ai.'); return; }
  const parts = BRIEFING_PARTS.map(([house, ask]) => [residents.find((r) => r.role === 'Director' && r.house === house), ask]).filter(([r]) => r);
  const t = {
    id: newId(), text: `Briefing voor ${day}`, from: 'todo', words: `Briefing voor ${day}`, createdAt: nowStamp(), briefing: usageDay(),
    status: 'split', owner: null, worker: null, askedPerson: null, brief: 'Ochtendbriefing: agenda, mail, reizen, eten en nieuws.', parentId: null,
    log: [], drafts: [], approvals: [], results: [], whatWasDone: [], summary: '', subtasks: [], kevinWhy: 'Briefing: vaste verdeling.',
  };
  logStep(t, 'harm', 'Harm vroeg om de briefing van vandaag.');
  logStep(t, 'kevin', `Kevin verdeelt de briefing over ${parts.map(([r]) => firstName(r.id)).join(', ')}.`);
  await saveTask(t);
  for (const [i, [r, ask]] of parts.entries()) {
    const line = `${firstName(r.id)}, het is briefingtijd: wil jij je deel doen?`;
    setTimeout(() => startCall('kevin', r.id, line), i * 1500);
    lineAdd('kevin', r.id, `${line} ${ask}`, 'call', t.id);
    const sub = await createTask(`Briefing — deel van ${firstName(r.id)}`, 'split', {
      owner: r.id, parentId: t.id, status: 'assigned', words: t.words,
      brief: `${ask} Keep it short (a few lines); Kevin bundles everyone's parts into Harm's briefing.`,
    });
    t.subtasks.push(sub.id);
  }
  await saveTask(t);
  toast('Kevin maakt je briefing. Het antwoord komt in het gesprek met Kevin.');
}

// Verder (one task) and Alles hervatten (every paused task), verbeterplan B5.
function resumeTask(t) {
  if (!t || t.status !== 'paused' || office.running.has(t.id)) return;
  if (t.subtasks) {                                     // a question to several directors: start the stopped parts, then bundle
    const parts = t.subtasks.map((id) => office.tasks.get(id)).filter(Boolean);
    const stopped = parts.filter((x) => x.status === 'paused');
    t.status = 'split'; saveTask(t);
    if (stopped.length) stopped.forEach(resumeTask); else combineParent(t.id);
    return;
  }
  if (t.doneAt && t.summary) {                          // the work was done; only finishing it stopped: finish, don't redo
    t.status = 'finishing';
    saveTask(t).then(() => finishIfReady(t)).catch((e) => { t.status = 'paused'; t.pauseReason = sampleErrorText(e); saveTask(t); });
    return;
  }
  t.status = t.owner ? 'assigned' : 'new'; saveTask(t); runTask(t);
}
function resumeAll() {
  const paused = [...office.tasks.values()].filter((t) => t.status === 'paused' && !(t.parentId && office.tasks.get(t.parentId) && office.tasks.get(t.parentId).status === 'paused'));
  paused.forEach(resumeTask);
  if (paused.length) toast(`${paused.length} ${paused.length === 1 ? 'taak gaat' : 'taken gaan'} verder (hooguit 3 tegelijk).`);
}

// Delete a task for good (B6): click twice, so it never goes by accident. Parts of a question go with it.
function deleteButton(t) {
  const b = document.createElement('button');
  b.className = 'small todo-del';
  b.textContent = '🗑';
  b.title = 'Verwijderen';
  b.setAttribute('aria-label', 'Taak verwijderen');
  b.onclick = (e) => {
    e.stopPropagation();
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Echt verwijderen?'; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ''; b.textContent = '🗑'; } }, 4000); return; }
    deleteTask(t);
  };
  return b;
}
async function deleteTask(t) {
  const ids = [t.id, ...(t.subtasks || [])];
  for (const id of ids) {
    office.tasks.delete(id);
    if (office.db) office.db.doc('tasks/' + id).delete().catch(() => {});
  }
  hideDone();
  renderTodo();
  toast('Taak verwijderd.');
}

// Hover a crossed-off task: exactly what was done.
function showDone(t, li) {
  office.hoverId = t.id;
  const pop = document.getElementById('todo-pop');
  const people = ['kevin', t.owner, t.worker].filter(Boolean).map(firstName).join(' → ');
  pop.innerHTML = `<div class="pop-title">${esc(t.text)}</div>
    <div class="pop-meta">${esc(people)} · klaar ${esc(new Date(t.doneAt).toLocaleString('nl-NL'))}</div>
    ${t.summary ? `<p>${esc(t.summary)}</p>` : ''}
    ${t.whatWasDone.length ? `<div class="pop-h">Wat er is gedaan</div><ol>${t.whatWasDone.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${t.drafts.length ? `<div class="pop-h">Concepten in je Gmail</div><ul>${t.drafts.map((d) => `<li>${esc(d.subject)}${d.to.length ? ' → ' + esc(d.to.join(', ')) : ''}</li>`).join('')}</ul>` : ''}
    ${(t.approvals || []).length ? `<div class="pop-h">Agenda en app-wijzigingen</div><ul>${t.approvals.map((a) => `<li>${a.kind === 'app' ? esc(a.app) + ': ' + esc(a.what) : esc(a.payload.summary || a.what)}: ${esc({ done: 'gedaan', declined: 'afgewezen', pending: 'wacht op jou', approving: 'bezig' }[a.status] || a.status)}</li>`).join('')}</ul>` : ''}
    ${t.noteForHarm ? `<div class="pop-h">Voor jou</div><p>${esc(t.noteForHarm)}</p>` : ''}`;
  const r = li.getBoundingClientRect();
  pop.hidden = false;
  const w = pop.offsetWidth;
  pop.style.top = Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, r.top)) + 'px';
  pop.style.left = (r.left - w - 12 > 8 ? r.left - w - 12 : Math.min(window.innerWidth - w - 8, r.right + 12)) + 'px';
}
function hideDone() { office.hoverId = null; document.getElementById('todo-pop').hidden = true; }

// ---------- wiring (to-do panel) ----------

document.getElementById('todo-btn').addEventListener('click', () => {
  const panel = document.getElementById('todo');
  panel.hidden = !panel.hidden;
  if (!panel.hidden && typeof closeProfile === 'function' && !document.getElementById('profile').hidden) closeProfile();
  document.getElementById('todo-btn').setAttribute('aria-pressed', String(!panel.hidden));
  if (!panel.hidden) document.getElementById('todo-input').focus();
});
document.getElementById('todo-close').addEventListener('click', () => { document.getElementById('todo').hidden = true; document.getElementById('todo-btn').setAttribute('aria-pressed', 'false'); canvas.focus(); });
const todoInput = document.getElementById('todo-input');
todoInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') { document.getElementById('todo-close').click(); return; }
  if (e.key === 'Enter' && todoInput.value.trim()) { createTask(todoInput.value, 'todo'); todoInput.value = ''; }
});
document.getElementById('todo-add').addEventListener('click', () => { if (todoInput.value.trim()) { createTask(todoInput.value, 'todo'); todoInput.value = ''; todoInput.focus(); } });

const todoSearch = document.getElementById('todo-search');
todoSearch.addEventListener('input', () => renderTodo());
todoSearch.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { todoSearch.value = ''; renderTodo(); } });
document.getElementById('resume-all').addEventListener('click', resumeAll);
document.getElementById('briefing-btn').addEventListener('click', () => startBriefing());

// Closing the page stops the work (it runs in this page): ask first while someone is working (B5).
window.addEventListener('beforeunload', (e) => {
  if (!office.running.size) return;
  e.preventDefault();
  e.returnValue = 'Het team is nog bezig. Als je de pagina sluit, stopt het werk (je kunt later op Verder drukken).';
  return e.returnValue;
});

renderTodo();
