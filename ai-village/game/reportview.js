// The full report on screen (Harm, 2026-11-02): "voordat een PDF gegenereerd wordt, wil ik de output eerst visueel
// in het scherm zien als een losse overlay". The same parts as the PDF, readable straight away; saving as a PDF is
// a button inside it, for when a file is really needed. Uses the helpers in report.js (whoName, niceDate, ...).

const reportView = { task: null, back: null };

function rvEsc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function rvLink(url, text) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return rvEsc(text || u);
  return `<a href="${rvEsc(u)}" target="_blank" rel="noopener noreferrer">${rvEsc(text || u)}</a>`;
}
function rvSection(title, html, cls = '') { return html ? `<section class="rv-sec ${cls}"><h3>${rvEsc(title)}</h3>${html}</section>` : ''; }

function reportHtml(t) {
  const done = t.status === 'done', couldNot = t.outcome === 'could_not';
  const chain = ['harm', 'kevin', t.owner, t.worker].filter(Boolean);
  const drafts = t.drafts || [], approvals = t.approvals || [], log = t.log || [];
  const parts = (t.subtasks || []).map((id) => office.tasks.get(id)).filter(Boolean);
  const people = chain.map((id) => `<div class="rv-person">${id === 'harm' ? '<span class="rv-face rv-initial">H</span>' : `<img class="rv-face" src="assets/portraits/${rvEsc(id)}.jpg" alt="">`}
      <b>${rvEsc(whoName(id))}</b><small>${rvEsc(whoRole(id))}</small></div>`).join('<span class="rv-arrow" aria-hidden="true">→</span>');
  const statusText = couldNot ? 'Niet gelukt' : done ? 'Klaar' : 'Bezig';
  return `
    <div class="rv-top">
      <span class="rv-pill ${couldNot ? 'bad' : done ? 'ok' : ''}">${statusText}</span>
      <span class="rv-dates">Toegevoegd ${rvEsc(niceDate(t.createdAt))}${t.doneAt ? ` · klaar ${rvEsc(niceDate(t.doneAt))} · ${rvEsc(duration(t.createdAt, t.doneAt))}` : ''}</span>
    </div>
    <p class="rv-asked">${t.from === 'chat' ? `Je vroeg het ${rvEsc(whoName(t.askedPerson))} persoonlijk: "${rvEsc(t.words)}"` : t.from === 'meeting' ? `In de vergadering gevraagd aan ${rvEsc(whoName(t.askedPerson))}.` : 'Van je takenlijst.'}</p>
    ${rvSection('In het kort', `<div class="rv-callout">${rvEsc(t.summary || 'Het team heeft deze taak afgerond.')}</div>`)}
    ${(t.top3 || []).length ? rvSection('Top 3 voor jou', `<ol class="rv-top3">${t.top3.map((x) => `<li>${rvEsc(x)}</li>`).join('')}</ol>`) : ''}
    ${t.noteForHarm ? rvSection('Voor jou', `<div class="rv-callout green"><b>${rvEsc(t.noteForHarm)}</b></div>`) : ''}
    ${t.suspicious ? rvSection('Let op', `<div class="rv-callout red">${rvEsc(t.suspicious)}</div>`) : ''}
    ${rvSection('Wie het deden', `<div class="rv-people">${people}</div>${t.kevinWhy ? `<p class="rv-soft">Waarom deze directeur: ${rvEsc(t.kevinWhy)}</p>` : ''}`)}
    ${(t.results || []).length ? rvSection('Resultaten', t.results.map((r) => `<div class="rv-card-in"><h4>${rvEsc(r.title || 'Resultaat')}</h4><p>${rvEsc(r.body)}</p></div>`).join('')) : ''}
    ${parts.length && !(t.results || []).length ? rvSection('Per directeur', parts.map((x) => `<div class="rv-card-in"><h4>${rvEsc(whoName(x.owner))}</h4><p>${rvEsc(x.summary || '')}</p></div>`).join('')) : ''}
    ${(t.whatWasDone || []).length ? rvSection('Wat er is gedaan', `<ol>${t.whatWasDone.map((x) => `<li>${rvEsc(x)}</li>`).join('')}</ol>`) : ''}
    ${drafts.length ? rvSection('Concepten in je Gmail', drafts.map((d) => `<div class="rv-card-in"><h4>${rvEsc(d.subject || '(geen onderwerp)')}</h4>
        <p class="rv-soft">Aan: ${rvEsc((d.to || []).join(', ') || '(antwoord in hetzelfde gesprek)')} · geschreven door ${rvEsc(whoName(d.by))}</p>
        <p>${rvEsc(d.body)}</p>${d.url ? `<p>${rvLink(d.url, 'Open het concept in Gmail')}</p>` : ''}
        <p class="rv-soft"><i>Niet verstuurd: het staat in je map Concepten.</i></p></div>`).join('')) : ''}
    ${approvals.length ? rvSection('Agenda- en app-wijzigingen', `<ul class="rv-changes">${approvals.map((a) => `<li>
        <span class="rv-st ${a.status === 'done' ? 'ok' : a.status === 'declined' ? 'bad' : ''}">${a.status === 'done' ? 'Gedaan' : a.status === 'declined' ? 'Afgewezen' : 'Wacht op jou'}</span>
        ${rvEsc(a.kind === 'app' ? `${a.app}: ${a.what}` : (a.payload.summary || a.what))}${a.kind !== 'app' && a.payload.startTime ? ` <span class="rv-soft">${rvEsc(a.payload.startTime.replace('T', ' ').slice(0, 16))}</span>` : ''}${a.url ? ' · ' + rvLink(a.url, 'openen in Google Agenda') : ''}</li>`).join('')}</ul>`) : ''}
    ${(t.sources || []).length ? rvSection('Bronnen', `<ol class="rv-sources">${t.sources.map((x) => `<li>${rvLink(x.url, x.title)}</li>`).join('')}</ol>`) : ''}
    ${(t.workerReports || []).length ? `<details class="rv-sec"><summary>Verslag van ${rvEsc(whoName(t.worker))} aan ${rvEsc(whoName(t.owner))}</summary>${t.workerReports.map((w) => `<p class="rv-pre">${rvEsc(w.text)}</p>`).join('')}</details>` : ''}
    ${log.length ? `<details class="rv-sec"><summary>Alles wat er gebeurde, stap voor stap (${log.length})</summary><table class="rv-log"><tbody>${log.map((l) => `<tr><td>${rvEsc(clock(l.at))}</td><td><b>${rvEsc(whoName(l.who))}</b></td><td>${rvEsc(l.text)}${l.link ? ' · ' + rvLink(l.link, 'link') : ''}</td></tr>`).join('')}</tbody></table></details>` : ''}`;
}

function showReport(t) {
  if (!t) return;
  reportView.task = t;
  reportView.back = document.activeElement;
  const box = document.getElementById('report-view');
  document.getElementById('rv-title').textContent = t.text;
  const body = document.getElementById('rv-body');
  body.innerHTML = reportHtml(t);
  if (typeof feedbackRow === 'function' && t.status === 'done') { const fb = feedbackRow(t.id); fb.classList.add('rv-feedback'); body.appendChild(fb); }
  body.scrollTop = 0;
  box.hidden = false;
  document.getElementById('rv-close').focus();
}
function closeReport() {
  document.getElementById('report-view').hidden = true;
  reportView.task = null;
  const back = reportView.back;
  reportView.back = null;
  if (back && back.isConnected && back.focus) back.focus(); else canvas.focus();
}

document.getElementById('rv-close').addEventListener('click', closeReport);
document.getElementById('rv-pdf').addEventListener('click', async () => {
  const t = reportView.task;
  if (!t) return;
  const b = document.getElementById('rv-pdf');
  b.disabled = true; b.textContent = 'PDF maken…';
  try { await offerReport(t); } finally { b.disabled = false; b.textContent = '💾 Opslaan als PDF'; }
});
document.getElementById('report-view').addEventListener('click', (e) => { if (e.target.id === 'report-view') closeReport(); });   // a click beside the card
document.getElementById('report-view').addEventListener('keydown', (e) => {
  e.stopPropagation();                                           // keys here are not for walking around
  if (e.key === 'Escape') closeReport();
});
