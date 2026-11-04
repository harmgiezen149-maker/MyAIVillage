// Harm's connectors on this page (Harm, 2026-11-03: "zoeken op internet is nog steeds heel beperkt").
// claude.ai only lets the page use a connector after Harm has said yes for this page, and it can only ask
// while Harm clicks something; in the middle of a director's work it just answers "connector access isn't
// confirmed for this artifact". So: when that happens, a bar with a button appears; the button makes one
// harmless read-only call from Harm's click, which brings up claude.ai's question. "Over mij" can test all of them.

const CONNECTOR_TESTS = {
  'Internet': ['wikipedia', { query: 'Nederland' }],
  'Dorpsinternet': ['wikipedia', { query: 'Nederland' }],
  'Gmail': ['list_drafts', { pageSize: 1 }],
  'Google Calendar': ['list_calendars', { pageSize: 1 }],
  'Kookboek': ['get_shopping_list', {}],
  'Darkglass': ['get_rig', {}],
};
const connectors = { waiting: new Set() };

function isConsentError(e) {
  const code = String(e && e.code || ''), msg = String(e && e.message || '');
  return ['approval_required', 'consent_required', 'not_confirmed', 'not_granted', 'permission_required'].includes(code)
    || /confirm|consent|toestemming|approv|permission/i.test(msg);
}
function needsConsent(server) {
  if (!CONNECTOR_TESTS[server]) return;
  connectors.waiting.add(server);
  renderConsentBar();
}
function renderConsentBar() {
  const bar = document.getElementById('consent-bar');
  const list = [...connectors.waiting];
  bar.hidden = !list.length;
  if (!list.length) return;
  bar.innerHTML = `<span>🔌 ${esc(list.join(' en '))} ${list.length === 1 ? 'heeft' : 'hebben'} jouw toestemming nodig voor dit dorp.</span>`
    + list.map((s) => `<button class="small primary" data-allow="${esc(s)}">${esc(s)} toestaan</button>`).join('')
    + '<button class="small" data-allow-close aria-label="Later">Later</button>';
}

// One test call, from Harm's click. Returns '' when it works, or a reason in Dutch.
async function testConnector(server) {
  if (!office.mcp) return 'niet beschikbaar in deze weergave (open het dorp op claude.ai)';
  const [tool, input] = CONNECTOR_TESTS[server];
  try {
    await office.mcp.callTool(server, tool, input);
    if (server === 'Internet' || server === 'Dorpsinternet') { try { localStorage.setItem('village-net-name', server); } catch (e) { /* fine */ } }
    connectors.waiting.delete(server);
    renderConsentBar();
    return '';
  } catch (e) {
    const code = e && e.code;
    if (code === 'server_not_connected') return 'niet gekoppeld: voeg de connector toe in claude.ai → Instellingen → Connectors';
    if (code === 'needs_reauth') return 'opnieuw inloggen nodig in claude.ai → Instellingen → Connectors';
    if (code === 'not_in_manifest') return 'staat niet in de toestemmingen van de pagina (meld dit aan Claude)';
    if (isConsentError(e)) return `nog niet toegestaan: kies Toestaan als claude.ai erom vraagt (${code || 'melding'}: ${String(e.message || '').slice(0, 120)})`;
    return (e && (e.message || code)) || 'onbekende fout';
  }
}

document.getElementById('consent-bar').addEventListener('click', async (e) => {
  if (e.target.closest('[data-allow-close]')) { document.getElementById('consent-bar').hidden = true; return; }
  const b = e.target.closest('[data-allow]');
  if (!b) return;
  const server = b.dataset.allow;
  b.disabled = true; b.textContent = 'Even kijken…';
  const why = await testConnector(server);
  if (!why) toast(`${server} werkt nu. Vraag het de directeur gerust opnieuw.`);
  else { toast(`${server}: ${why}`); b.disabled = false; b.textContent = `${server} toestaan`; }
});

// "Koppelingen" in Over mij: test them all, one by one, from this click.
document.getElementById('connectors-test').addEventListener('click', async () => {
  const ul = document.getElementById('connectors-list');
  ul.innerHTML = Object.keys(CONNECTOR_TESTS).map((s) => `<li data-c="${esc(s)}"><b>${esc(s)}</b> <span>bezig…</span></li>`).join('');
  const results = {};
  for (const s of Object.keys(CONNECTOR_TESTS)) {
    results[s] = await testConnector(s);
    ul.querySelector(`[data-c="${CSS.escape(s)}"] span`).textContent = results[s] ? '✗ ' + results[s] : '✓ werkt';
  }
  const works = ['Internet', 'Dorpsinternet'].find((n) => !results[n]);
  if (works) { try { localStorage.setItem('village-net-name', works); } catch (e) { /* fine */ } }
  // the internet has two possible names; when one works, the other one does not matter
  for (const [a, b] of [['Internet', 'Dorpsinternet'], ['Dorpsinternet', 'Internet']]) {
    if (!results[a] && results[b]) { ul.querySelector(`[data-c="${b}"]`).remove(); connectors.waiting.delete(b); renderConsentBar(); }
  }
});
