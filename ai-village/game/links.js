// Direct links (Harm, 2026-11-03): ".../artifact/6w8CwvAmosjzt8C26LowVc#rosie" opens the village straight into the
// conversation with Rosie; "#kevin" with Kevin, "#taken" opens the to-do list. claude.ai passes a plain #name on to
// the page (nothing more: no #key=value). The address follows the open conversation, so it can be copied or saved
// as a shortcut on the phone's home screen.

const VILLAGE_URL = 'https://claude.ai/artifact/6w8CwvAmosjzt8C26LowVc';

function linkName(id) {
  const n = id === 'kevin' ? 'kevin' : firstName(id);
  return String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}
function personLink(id) { return `${VILLAGE_URL}#${linkName(id)}`; }

function setHash(name) {
  const want = name ? '#' + name : '';
  if (location.hash === want) return;
  try { history.replaceState(null, '', want || location.pathname + location.search); } catch (e) { /* not allowed here: leave it */ }
}

// What the #name in the address asks for.
function openFromHash() {
  const h = decodeURIComponent(location.hash.slice(1)).toLowerCase();
  if (!h) return;
  if (h === 'taken') { if (document.getElementById('todo').hidden) document.getElementById('todo-btn').click(); return; }
  const id = findPerson(h);
  if (!id) return;
  if (office.chat && office.chat.id === id && !document.getElementById('chat').hidden) return;
  if (id === 'kevin') openKevin(); else openChat(id);
}

// Copy a link (only works from a click; if the browser says no, the link is shown so Harm can copy it by hand).
async function copyLink(url) {
  try { await navigator.clipboard.writeText(url); toast('Link gekopieerd: ' + url); }
  catch (e) { toast('Kopiëren mocht niet. De link is: ' + url); }
}

// The 🔗 button in the conversation box.
document.getElementById('chat-link').addEventListener('click', () => { if (office.chat) copyLink(personLink(office.chat.id)); });

// "Snelkoppelingen" in Over mij: a link per person.
function renderShortcuts() {
  const ul = document.getElementById('profile-links');
  if (!ul) return;
  const ids = ['kevin', ...DIRECTORS.map((d) => d.id)];
  ul.innerHTML = ids.map((id) => `<li><span><b>${esc(id === 'kevin' ? 'Kevin' : firstName(id))}</b> <span class="profile-hint">${esc(id === 'kevin' ? 'Stafchef' : residentById(id).building.job)}</span></span>
    <button class="small" data-link="${esc(personLink(id))}" aria-label="Link naar ${esc(id === 'kevin' ? 'Kevin' : firstName(id))} kopiëren">🔗 Kopieer</button></li>`).join('')
    + `<li><span><b>Takenlijst</b></span><button class="small" data-link="${VILLAGE_URL}#taken" aria-label="Link naar de takenlijst kopiëren">🔗 Kopieer</button></li>`;
}
document.getElementById('profile-links').addEventListener('click', (e) => { const b = e.target.closest('[data-link]'); if (b) copyLink(b.dataset.link); });
document.getElementById('profile-btn').addEventListener('click', renderShortcuts);

window.addEventListener('hashchange', openFromHash);
// On arrival: after "Het dorp in" (the intro covers everything until then), or right away if it is already gone.
(async () => {
  await allScriptsRun;
  if (!location.hash) return;
  if (document.getElementById('intro').hidden) openFromHash();
  else document.getElementById('enter').addEventListener('click', () => setTimeout(openFromHash, 300), { once: true });
})();
