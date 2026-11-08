// Rosie, the village therapist (Harm, 2026-11-08): "Ik wil hem aanpassen naar dorps therapeut en hem de Skill
// positieve ervaringen laten uitvoeren. De sessie moet dan ook in zijn huis plaats vinden, waarbij ik plaats neem in
// haar huisje en daar samen met haar mijn positieve ervaringen bespreken." Harm chose: Rosie is she/her, keeps the
// family and cookbook work, the house is called "Praktijk van Rosie", and she gives an evening reminder.
//
// - The session: Harm walks into the Praktijk and sits on the sofa by the fire; Rosie sits in the armchair across.
//   A quiet session box opens. Rosie follows Harm's skill "positieve ervaringen" (game text below).
// - Privacy (from the skill): the conversation is kept ONLY in this page's memory. It is never written to the village
//   database, never into Rosie's memory, Kevin's line, the village talk, the to-do list or a PDF. The only place it
//   goes is Harm's own list in Google Drive, and only after Harm presses "Opslaan in mijn lijst".
// - Saving works like the skill: read the spreadsheet as text, add the rows, upload a new CSV version (Drive turns it
//   into a spreadsheet), check it, and only then move the previous version to the trash. Never .xlsx, never base64.

const THERAPIST = 'rosie-bell', PRAKTIJK = 'family-cottage';
// Harm on the sofa facing the fire side, Rosie in the armchair across the little table (room coordinates).
const SESSION_SEATS = { harm: { seat: [226, 414], dir: 'right' }, rosie: { seat: [490, 420], dir: 'left' } };
const DRIVE = 'Google Drive', THERAPIE_MAP = '1uDxnN3DDuVyUidUzc8Y5tarlnNlAQMwU', LIJST = 'Positieve ervaringen - Harm';
const SHEET_TYPE = 'application/vnd.google-apps.spreadsheet';
const LIJST_KOP = ['Datum', 'Ervaring', 'Waarom het fijn was', 'Gevoel', 'Sterkte (0-100)', 'Reflexie'];

const therapy = { active: false, harmSeated: false, turns: [], busy: false, staged: null, list: null, leg: '', aim: null, daisyWas: null, scene: null, sceneAt: 0 };

// Painted session pictures (Harm, 2026-11-08, made with Artlist): the Praktijk with Harm and Rosie painted into the
// sofa and the armchair, so they really sit in them. Once both are seated the room fades over to one of these, chosen
// at random per session (Harm: "laat dan de versies random zien"), and the two little figures are not drawn.
const SESSION_SCENES = ['family-cottage-sessie-1', 'family-cottage-sessie-2', 'family-cottage-sessie-3', 'family-cottage-sessie-4'];
const sessionScenes = {};
function loadSessionScenes() {
  for (const n of SESSION_SCENES) {
    if (sessionScenes[n]) continue;
    const img = new Image();
    sessionScenes[n] = { img, ready: false };
    img.onload = () => { sessionScenes[n].ready = true; };
    img.src = `assets/rooms/${n}.jpg`;
  }
}
function pickSessionScene() {
  let last = '';
  try { last = localStorage.getItem('village-session-scene') || ''; } catch (e) { /* no storage */ }
  const pool = SESSION_SCENES.length > 1 ? SESSION_SCENES.filter((n) => n !== last) : SESSION_SCENES;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem('village-session-scene', pick); } catch (e) { /* no storage */ }
  return pick;
}
// The painted picture to show now (with how far it has faded in), or null: only while both sit and it has loaded.
function sessionSceneNow() {
  if (!therapy.active || !therapy.harmSeated || !therapy.scene) return null;
  const rosie = residentById(THERAPIST);
  if (!rosie || !rosie.sessionSeat || !rosie.seated) { therapy.sceneAt = 0; return null; }
  const s = sessionScenes[therapy.scene];
  if (!s || !s.ready) return null;
  if (!therapy.sceneAt) therapy.sceneAt = state.time;
  return { img: s.img, alpha: Math.min(1, (state.time - therapy.sceneAt) / 0.9) };
}

function vandaag() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// ---------- Rosie's instructions: Harm's skill "positieve ervaringen", for the conversation in the village ----------
function rosieRules() {
  return `Je bent Rosie Bell (zij/haar), de dorpstherapeut in Harms AI-dorp. Harm zit nu bij jou in de Praktijk van Rosie, op de bank bij de open haard; jij zit tegenover in de fauteuil. Vandaag is ${vandaag()} (Europe/Amsterdam).
Dit is een sessie volgens Harms eigen skill "positieve ervaringen": Harm houdt voor zijn therapie een lijst bij met positieve ervaringen (een Google Spreadsheet in de Drive-map Therapie). Je eerste bericht ("Vertel eens over je dag…") is al verstuurd.

JE ROL
- Warme, nieuwsgierige, rustige gesprekspartner in de rol van CGT-therapeut die helpt positieve ervaringen opmerken en vasthouden. Je helpt zien en benoemen, niet oppeppen.
- Je doet NIET: cheerleaden of overdrijven ("Wat geweldig!"), negatieve dingen wegpraten of omdenken, advies geven, analyseren of verklaren. Een zware dag mag een zware dag zijn.
- Nederlands, je/jij, korte berichten. Eén vraag per bericht (hooguit twee die bij elkaar horen). Geen keuzemenu's of formulieren; gewoon gesprek. Geen Markdown-koppen; een korte lijst met "- " mag.
- Geen vast aantal ervaringen. Ook één klein moment is genoeg. Klein telt: koffie in de zon, een goed gesprek, iets afgerond, muziek of de band, rust na de yoga, iemand die bedankte.

STAP 2 - ZIJN VERHAAL VERWERKEN
Zoek in zijn verhaal: momenten die hij zelf fijn noemt (die staan vast); momenten die hij noemt maar niet positief benoemt terwijl er iets goeds in zit (stel die voor als vraag, niet als conclusie: "Je noemt ook dat je die flow werkend kreeg. Hoe was dat?"); positieve momenten binnen een lastig stuk (erken het lastige kort en echt, vraag dan naar dat ene goede stukje).
Geef een korte terugkoppeling: één zin die zijn dag erkent zoals die was, dan de momenten die je zag (in zijn woorden, als lijstje), en eindig met: welke daarvan hij ook als fijn ervaart, en of je er een mist.

STAP 3 - SAMEN AANSCHERPEN (per ervaring, één vraag per bericht, alleen wat nog niet helder is)
1. Het moment concreet: wat gebeurde er precies, wie waren erbij, wanneer was het het fijnst? Bij iets algemeens: "Als je één moment kiest waarop je dat merkte, welk is dat?"
2. Waarom het fijn was: "Wat maakte het fijn voor jou?" / "Wat betekende het voor je op dat moment?"
3. Gevoel en sterkte: "Welk gevoel hoorde erbij?" (helpwoorden als hij vastzit: blij, trots, rustig, dankbaar, verbonden, opgelucht, voldaan, plezier), daarna "Hoe sterk was dat, van 0 tot 100?" Een lage score is prima.
Na elke ervaring één zin samenvatting in zijn woorden ("Dus: …, klopt dat?"). Vraag daarna of er nog een moment was. Zegt hij nee: door naar stap 4. Niet aandringen.
WEGNUANCEREN ("stelde niks voor", "dat hoort bij mijn werk", "was leuk, maar…", de eer bij een ander): benoem kort zonder oordeel wat je hoort, breng hem terug naar het moment ("Hoe voelde het op dat moment zelf, voordat je het kleiner maakte?" / "Als je de 'maar' even weglaat, wat blijft er dan over?"). Hooguit één keer per ervaring (stap 3 en 6 samen). Houdt hij het klein: accepteer het en noteer het zoals hij het zegt.

EEN DAG ZONDER POSITIEVE ERVARING: zeg dat dat mag. Eén keer zacht vragen naar een heel klein moment, niet doorduwen. Niets gevonden: niets opslaan, kort en warm afsluiten. Gaat het vooral over iets wat hem dwarszit: erken het en bied aan dat hij daar later een G-schema van kan maken (zijn skill g-schema-invullen). Dit gesprek blijft over het positieve.

VEILIGHEID: noemt Harm gedachten aan de dood, zelfdoding of zichzelf iets aandoen, of klinkt het alsof hij nu in acute nood zit: stop met de lijst. Reageer persoonlijk en met zorg, vraag rechtstreeks hoe het nu met hem gaat, en wijs op hulp: 113 Zelfmoordpreventie (0800-0113, gratis, dag en nacht, of chat via 113.nl), bij acuut gevaar 112, en zijn huisarts of huisartsenpost en zijn eigen therapeut. Doe geen uitspraken over geheimhouding of wat hulpdiensten wel of niet doen.

STAP 4 - SAMENVATTEN EN BEVESTIGEN: laat alle ervaringen van vandaag in één overzichtelijk blok zien (per ervaring: ervaring, waarom fijn, gevoel + sterkte) en vraag of het klopt. Zijn woorden, ik-vorm, alleen spelling en zinsbouw opschonen; geen therapietaal, niets aandikken of verkleinen. Ervaring en waarom elk 1-2 zinnen. Gevoel: één of twee woorden met hoofdletter. Sterkte: alleen het getal.

STAP 6 - REFLECTIE-INTERVIEW PER ERVARING (in de volgorde van de lijst; noem steeds kort welke ervaring aan de beurt is)
De reflectie gaat een laag dieper dan "waarom het fijn was": wat het met hem doet en wat het over hem zegt, als een keten van korte ik-uitspraken van concreet naar dieper, gescheiden door " > ". Voorbeelden uit zijn lijst:
- "Ik neem de tijd voor mijzelf > ik ben meer bewust van wat mij helpt > ik ben in staat om een balans te vinden (het hoeft niet altijd perfect of goed)"
- "Ik zet mijzelf ertoe om de wereld in te gaan, ondanks hoe ik mij voel > ik geef niet op > ik ben onderdeel van een groep > ik word geaccepteerd > ik mag er blijkbaar toch zijn"
- "Ik ben een teamplayer" (één uitspraak is ook goed); "Ik ben goed in mijn werk (75%)"
Patroon: vaak begint hij bij wat hij deed of durfde, via wat hij kan of is, soms tot hoe hij zichzelf ziet of erbij hoort. 1 tot 6 stappen.
Interview met de pijl-vraag, één vraag per bericht, met steeds zijn eigen laatste antwoord: open met "Als je naar deze ervaring kijkt: wat zegt het over jou dat dit gebeurde?" (of "Wat doet het met je?"); doorvragen: "En als dat klopt, dat je [zijn woorden], wat zegt dat dan over jou?"; stoppen als het raak voelt, als hij zegt dat het klaar is, of na vier à vijf stappen: "Voelt dit als de kern, of zit er nog iets onder?" (één keer).
Hij vult in, jij niet: geen conclusies of mooie formuleringen. Zit hij vast: een open aanzet ("Iets als 'ik kan...' of 'ik durf...'?") of één keer een thema uit zijn lijst. Zegt hij een percentage, neem dat tussen haakjes over (vraag er niet zelf naar). Woorden als "blijkbaar" mag je één keer benoemen (telt mee voor de één-keer-regel). Komt er iets negatiefs boven: erken het kort en echt, niet analyseren, terug naar wat déze ervaring laat zien. Geen reflectie of niets: prima, blijft leeg.
Na elke ervaring de keten in één regel: "Dus: *…* Klopt dat zo?" Na alle ervaringen de reflecties nog één keer onder elkaar, en vragen of hij nog iets wil aanpassen.

STAP 7 - OPSLAAN: roep pas als alles bevestigd is propose_save aan met alle ervaringen van vandaag (datum DD-MM-JJJJ, ervaring, waarom, gevoel, sterkte als getal, reflectie of leeg). Harm ziet ze dan en drukt zelf op "Opslaan in mijn lijst"; dat doet de rest. Zeg in je bericht kort dat hij ze kan opslaan met die knop.

LEGE REFLECTIES SAMEN AANVULLEN: alleen als Harm erom vraagt. Roep dan read_empty_reflections aan; geef een kort overzicht (aantal, per ervaring datum + een paar woorden) en vraag waar hij wil beginnen (anders de oudste). Per ervaring: laat zien wat er staat, dan het interview zoals in stap 6. Na zo'n vijf ervaringen vragen of hij verder wil. Daarna propose_fill met alleen de ervaringen waarvoor een reflectie is bevestigd (rij en de ervaring-tekst precies zoals read_empty_reflections ze gaf).

TUSSENTIJDS STOPPEN: wil Harm stoppen, dwing niets af; vraag of hij wil opslaan wat al helder is (propose_save met lege velden waar nodig).
Bewaar de inhoud nergens anders. Praat er niet over met anderen in het dorp.`;
}

// ---------- the session box ----------
function sessionLog() { return document.getElementById('session-log'); }
function renderSession() {
  const log = sessionLog();
  log.innerHTML = '';
  for (const t of therapy.turns) {
    const div = document.createElement('div');
    div.className = 'msg ' + (t.role === 'user' ? 'me' : t.role === 'note' ? 'hint' : 'them');
    div.textContent = t.content;
    if (t.link) { const a = document.createElement('a'); a.href = t.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = ' Open je lijst'; div.appendChild(a); }
    log.appendChild(div);
  }
  if (therapy.streaming) { const div = document.createElement('div'); div.className = 'msg them'; div.textContent = therapy.streaming; log.appendChild(div); }
  else if (therapy.busy) log.insertAdjacentHTML('beforeend', '<div class="msg hint">Rosie denkt even na…</div>');
  renderStaged();
  log.scrollTop = log.scrollHeight;
  document.getElementById('session-send').disabled = therapy.busy;
}
function renderStaged() {
  const box = document.getElementById('session-staged');
  const s = therapy.staged;
  box.hidden = !s;
  if (!s) return;
  const rows = s.kind === 'add'
    ? s.rows.map((r) => `<li><b>${esc(r[1])}</b><br><span class="todo-meta" style="margin:0">${esc(r[0])} · ${esc(r[3])} ${esc(r[4])}${r[2] ? ' · ' + esc(r[2]) : ''}</span>${r[5] ? `<br><i>${esc(r[5])}</i>` : ''}</li>`).join('')
    : s.items.map((x) => `<li><b>${esc(x.ervaring)}</b><br><i>${esc(x.reflectie)}</i></li>`).join('');
  box.innerHTML = `<div class="pop-h">${s.kind === 'add' ? 'Deze ervaringen komen in je lijst' : 'Deze reflecties komen in je lijst'}</div><ul>${rows}</ul>
    <button id="session-save" class="primary" ${s.saving ? 'disabled' : ''}>${s.saving ? 'Bezig met opslaan…' : 'Opslaan in mijn lijst'}</button>
    <button id="session-unstage" class="small" ${s.saving ? 'disabled' : ''}>Nog niet</button>`;
  document.getElementById('session-save').onclick = () => saveStaged();
  document.getElementById('session-unstage').onclick = () => { therapy.staged = null; renderSession(); };
}

// ---------- start, sit down, end ----------
function startSession() {
  if (therapy.active) { document.getElementById('session').hidden = false; return; }
  if (state.meeting) { toast('Sluit eerst de vergadering. Daarna kun je bij Rosie langs.'); return; }
  const rosie = residentById(THERAPIST);
  if (!rosie) return;
  if (typeof closeChat === 'function' && office.chat) closeChat();
  if (typeof stopVisit === 'function') stopVisit();
  Object.assign(therapy, { active: true, harmSeated: false, turns: [], busy: false, staged: null, list: null, leg: '', aim: null, streaming: null, scene: pickSessionScene(), sceneAt: 0 });
  loadSessionScenes();
  therapy.turns.push({ role: 'assistant', content: 'Hoi Harm. Fijn dat je er bent. Vertel eens over je dag: wat heb je allemaal gedaan en meegemaakt? Alles mag erin, ook wat lastig was. Daarna zoeken we samen de positieve momenten eruit.' });
  // Rosie walks to her armchair; Daisy waits outside while the session lasts
  rosie.inMeeting = false; rosie.summoned = false; rosie.chatting = null;
  if (typeof standUp === 'function') standUp(rosie);
  rosie.plan = null; rosie.path = null;
  const daisy = residents.find((r) => r.role === 'Worker' && r.boss && r.boss.id === THERAPIST);
  if (daisy) { therapy.daisyWas = { mode: daisy.mode, modeUntil: daisy.modeUntil }; daisy.mode = 'free'; daisy.modeUntil = Infinity; daisy.atWork = false; }
  for (const id of ['todo', 'dock', 'people', 'plans', 'profile']) { const el = document.getElementById(id); if (el && !el.hidden) el.hidden = true; }
  if (typeof setHash === 'function') setHash('rosie-sessie');
  document.getElementById('session').hidden = false;
  renderSession();
  focusTyping(document.getElementById('session-input'));
  if (typeof audio !== 'undefined' && audio.setSessionQuiet) audio.setSessionQuiet(true);
}

function endSession() {
  if (!therapy.active) return;
  const leave = () => {
    therapy.active = false;
    const rosie = residentById(THERAPIST);
    if (rosie) { if (typeof standUp === 'function') standUp(rosie); rosie.sessionSeat = false; rosie.modeUntil = state.time + 5; }
    if (therapy.harmSeated) {
      const [x, y] = SESSION_SEATS.harm.seat;
      const p = nearestOpenPoint(PRAKTIJK, x + 60, y + 90) || ROOMS[PRAKTIJK].start;
      state.player.x = p[0]; state.player.y = p[1];
    }
    therapy.harmSeated = false; therapy.scene = null; therapy.sceneAt = 0;
    const daisy = residents.find((r) => r.role === 'Worker' && r.boss && r.boss.id === THERAPIST);
    if (daisy && therapy.daisyWas) { daisy.modeUntil = state.time + 10; therapy.daisyWas = null; }
    // the conversation is forgotten: nothing of it is kept anywhere but Harm's list in Drive
    therapy.turns = []; therapy.staged = null; therapy.list = null; therapy.streaming = null;
    document.getElementById('session').hidden = true;
    if (typeof setHash === 'function') setHash('');
    if (typeof audio !== 'undefined' && audio.setSessionQuiet) audio.setSessionQuiet(false);
    canvas.focus();
  };
  if (therapy.staged && !therapy.staged.saving) {
    const b = document.getElementById('session-end');
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Nog niet opgeslagen. Toch afsluiten?'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Sessie afsluiten'; }, 5000); return; }
  }
  leave();
}

function seatFeet(s) { const H = heightIn(PRAKTIJK), off = SEAT_TO_FEET[s.dir]; return [s.seat[0] + off[0] * H, s.seat[1] + off[1] * H]; }

// Walking to the Praktijk and sitting down (Harm), and keeping Rosie in her chair (called from updateResident).
function therapyHold(r, dt) {
  if (!therapy.active) return false;
  if (r.id === THERAPIST) {
    r.chatting = null;                                          // no village small talk during a session
    if (r.sessionSeat && r.seated) return true;
    if (!r.plan) {
      const s = SESSION_SEATS.rosie, [fx, fy] = seatFeet(s);
      const to = nearestOpenPoint(PRAKTIJK, fx, fy + 10) || roomInside(PRAKTIJK);
      planTo(r, PRAKTIJK, to, () => { sitAt(r, { seat: s.seat, dir: s.dir }); r.sessionSeat = true; });
      r.plan.exact = true;
    }
    followPlan(r, dt);
    return true;
  }
  if (r.where === PRAKTIJK) {                                   // nobody else in the room during a session
    if (!r.plan || !r.leavingPraktijk) {
      if (typeof standUp === 'function') standUp(r);
      const b = BUILDINGS.find((x) => x.room === PRAKTIJK);
      const out = nearestOpenPoint('map', b.door[0] + 40, b.door[1] + 110) || [b.door[0], b.door[1] + 80];
      planTo(r, 'map', out, () => { r.leavingPraktijk = false; r.wait = 3; });
      r.leavingPraktijk = true;
    }
    followPlan(r, dt);
    return true;
  }
  return false;
}

function stepSession() {
  if (!therapy.active || therapy.harmSeated || state.fade > 0) return;
  const p = state.player;
  if (state.scene === PRAKTIJK) {
    const [fx, fy] = seatFeet(SESSION_SEATS.harm);
    const goal = nearestOpenPoint(PRAKTIJK, fx, fy + 6) || [fx, fy];
    if (Math.hypot(p.x - goal[0], p.y - goal[1]) < 14) {
      state.target = null; state.route = null;
      therapy.harmSeated = true;
      return;
    }
    if (therapy.leg !== 'seat' || !state.target) { therapy.leg = 'seat'; state.target = goal; therapy.aim = goal; }
    return;
  }
  if (state.scene === 'map') {
    const b = BUILDINGS.find((x) => x.room === PRAKTIJK);
    if (therapy.leg !== 'door' || !state.target) { therapy.leg = 'door'; state.doorArmed = true; state.target = b.door.slice(); therapy.aim = state.target; }
    return;
  }
  if (therapy.leg !== 'out' || !state.target) { therapy.leg = 'out'; state.target = ROOMS[state.scene].exit.slice(); therapy.aim = state.target; }
}
setInterval(stepSession, 150);

// What drawRoom draws for Harm while seated in the Praktijk.
function therapyDrawHarm() { drawSeated('harm', SESSION_SEATS.harm); }

// ---------- the conversation ----------
async function sendSession() {
  const box = document.getElementById('session-input');
  const said = box.value.trim();
  if (!said || therapy.busy) return;
  if (!office.sample) { therapy.turns.push({ role: 'note', content: 'Praten met Rosie heeft Claude nodig: open het dorp op claude.ai.' }); renderSession(); return; }
  box.value = '';
  therapy.turns.push({ role: 'user', content: said });
  therapy.busy = true; renderSession();
  try {
    const msgs = [];
    for (const t of therapy.turns) {
      if (t.role === 'note') continue;
      const role = t.role === 'user' ? 'user' : 'assistant';
      if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + t.content;
      else msgs.push({ role, content: t.content });
    }
    if (!msgs.length || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '(Harm komt binnen en gaat zitten.)' });
    msgs[0] = { role: 'user', content: rosieRules() + '\n\n---\nHarm: ' + msgs[0].content };
    countCall(null);
    const { text } = await office.sample(msgs, { model: MODELS.director, modelTier: 'complex', cache: false, tools: sessionTools(),
      onText: ({ text: t }) => { therapy.streaming = t; renderSession(); } });
    therapy.turns.push({ role: 'assistant', content: text });
  } catch (e) {
    therapy.turns.push({ role: 'note', content: sampleErrorText(e) });
  } finally {
    therapy.busy = false; therapy.streaming = null;
    renderSession();
  }
}

function sessionTools() {
  return [
    { name: 'propose_save', description: "Show Harm today's confirmed experiences, ready to be saved in the list in Drive. Nothing is saved until Harm presses 'Opslaan in mijn lijst'.",
      inputSchema: { type: 'object', properties: { experiences: { type: 'array', items: { type: 'object', properties: {
        datum: { type: 'string', description: 'DD-MM-JJJJ' }, ervaring: { type: 'string' }, waarom: { type: 'string' }, gevoel: { type: 'string' }, sterkte: { type: 'number' }, reflectie: { type: 'string' } }, required: ['datum', 'ervaring'] } } }, required: ['experiences'] },
      execute: async ({ experiences }) => {
        const rows = (experiences || []).map((x) => [tekst(x.datum), tekst(x.ervaring), tekst(x.waarom), tekst(x.gevoel),
          x.sterkte === undefined || x.sterkte === null || x.sterkte === '' ? '' : String(Math.round(Number(String(x.sterkte).replace(',', '.')) || 0)), tekst(x.reflectie)]);
        if (!rows.length) return 'No experiences given.';
        therapy.staged = { kind: 'add', rows };
        renderSession();
        return 'Shown to Harm with the button "Opslaan in mijn lijst"; saving happens when Harm presses it. Tell Harm briefly.';
      } },
    { name: 'read_empty_reflections', description: "Read Harm's list in Drive and return the experiences that have no reflection yet (rij = sheet row). Only when Harm asks to fill in empty reflections.",
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const L = await readLijst();
        therapy.list = L;
        const empty = L.rows.map((r, i) => ({ rij: i + 2, datum: r[0], ervaring: r[1], waarom: r[2], gevoel: r[3], sterkte: r[4] })).filter((x) => !L.rows[x.rij - 2][5]);
        return JSON.stringify({ totaal: L.rows.length, zonder_reflectie: empty.length, rijen: empty });
      } },
    { name: 'propose_fill', description: 'Show Harm the confirmed reflections for older experiences, ready to be saved. Nothing is saved until Harm presses the button.',
      inputSchema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { rij: { type: 'number' }, ervaring: { type: 'string' }, reflectie: { type: 'string' } }, required: ['rij', 'ervaring', 'reflectie'] } } }, required: ['items'] },
      execute: async ({ items }) => {
        const list = (items || []).filter((x) => tekst(x.reflectie)).map((x) => ({ rij: Number(x.rij), ervaring: tekst(x.ervaring), reflectie: tekst(x.reflectie) }));
        if (!list.length) return 'No reflections given.';
        therapy.staged = { kind: 'fill', items: list };
        renderSession();
        return 'Shown to Harm with the button "Opslaan in mijn lijst".';
      } },
  ];
}

// ---------- the list in Drive (the skill's positief_csv.py, as JavaScript) ----------
function tekst(v) { return String(v === undefined || v === null ? '' : v).split(/\s+/).filter(Boolean).join(' '); }
function unescapeCel(c) { return c.replace(/\\([\\`*_{}\[\]()#+\-.!|>"<'&~])/g, '$1'); }
async function driveCall(tool, input) {
  if (!office.mcp) throw new Error('Google Drive is niet beschikbaar in deze weergave.');
  try { const r = await office.mcp.callTool(DRIVE, tool, input); return r.payload !== undefined ? r.payload : r.content; }
  catch (e) {
    if (typeof isConsentError === 'function' && isConsentError(e)) { needsConsent(DRIVE); throw new Error('Google Drive is nog niet toegestaan voor dit dorp. Druk bovenin op "Google Drive toestaan" en probeer het opnieuw.'); }
    if (e && e.code === 'server_not_connected') throw new Error('Google Drive is niet gekoppeld in claude.ai → Instellingen → Connectors.');
    throw new Error('Google Drive zei: ' + ((e && (e.message || e.code)) || 'fout'));
  }
}
function contentText(p) {
  if (typeof p === 'string') return p;
  if (!p) return '';
  if (typeof p.content === 'string') return p.content;
  if (typeof p.text === 'string') return p.text;
  if (Array.isArray(p)) return p.map((x) => (x && x.text) || '').join('\n');
  if (Array.isArray(p.content)) return p.content.map((x) => (x && x.text) || '').join('\n');
  return JSON.stringify(p);
}
function leesTabel(txt) {
  const rijen = [];
  for (let regel of String(txt).split('\n')) {
    regel = regel.trim();
    if (!regel.startsWith('|')) continue;
    const cellen = regel.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => unescapeCel(c.trim()));
    if (cellen.every((c) => /^:?-*:?$/.test(c))) continue;          // separator line (or an empty header)
    if (cellen[0] === 'Datum') continue;
    while (cellen.length < 6) cellen.push('');
    if (cellen.length !== 6) throw new Error(`rij met ${cellen.length} kolommen`);
    rijen.push(cellen.map(tekst));
  }
  return rijen;
}
function controleer(rijen) {
  rijen.forEach((r, i) => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(r[0])) throw new Error(`sheetrij ${i + 2}: datum '${r[0]}' is niet DD-MM-JJJJ`);
    if (r[4] && !/^\d{1,3}$/.test(r[4])) throw new Error(`sheetrij ${i + 2}: sterkte '${r[4]}' is geen getal`);
    if (!r[1]) throw new Error(`sheetrij ${i + 2}: ervaring is leeg`);
  });
}
function naarCsv(rijen) {
  controleer(rijen);
  const cel = (c) => { c = c.startsWith("'") ? '’' + c.slice(1) : c; return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; };
  return [LIJST_KOP, ...rijen].map((r) => r.map(cel).join(',')).join('\n') + '\n';
}
async function zoekLijst() {
  const out = await driveCall('search_files', { query: `parentId = '${THERAPIE_MAP}' and title = '${LIJST}' and mimeType = '${SHEET_TYPE}'`, excludeContentSnippets: true, orderBy: 'modifiedTime desc', pageSize: 5 });
  const files = (out && out.files) || [];
  return { file: files[0] || null, meer: files.length > 1 };
}
async function leesBestand(id) {
  const txt = contentText(await driveCall('read_file_content', { fileId: id }));
  const m = /Table Range:\s*A1:F(\d+)/i.exec(txt);
  return { rows: leesTabel(txt), n: m ? Number(m[1]) : null };
}
async function readLijst() {
  const { file, meer } = await zoekLijst();
  if (!file) return { id: null, rows: [], n: 1, meer: false };
  const L = await leesBestand(file.id);
  if (L.n !== null && L.rows.length !== L.n - 1) throw new Error(`de lijst werd niet helemaal gelezen (${L.rows.length} van ${L.n - 1} rijen)`);
  return { id: file.id, rows: L.rows, n: L.n, meer };
}
async function uploadEnCheck(rijen, oudId) {
  const csv = naarCsv(rijen);
  for (let poging = 0; poging < 2; poging++) {
    const nieuw = await driveCall('create_file', { title: LIJST, parentId: THERAPIE_MAP, contentMimeType: 'text/csv', textContent: csv });
    const id = nieuw && (nieuw.id || (nieuw.file && nieuw.file.id));
    const url = nieuw && (nieuw.viewUrl || (nieuw.file && nieuw.file.viewUrl)) || '';
    if (!id) throw new Error('Drive gaf geen nieuw bestand terug');
    let ok = false;
    try {
      const L = await leesBestand(id);
      const laatste = L.rows[L.rows.length - 1], verwacht = rijen[rijen.length - 1];
      ok = L.n === rijen.length + 1 && laatste && laatste[1] === verwacht[1] && laatste[5] === verwacht[5];
    } catch (e) { ok = false; }
    if (ok) {
      let opgeruimd = true;
      if (oudId) { try { await driveCall('trash_file', { fileId: oudId }); } catch (e) { opgeruimd = false; } }
      return { id, url, opgeruimd };
    }
    try { await driveCall('trash_file', { fileId: id }); } catch (e) { /* leave it */ }
  }
  throw new Error('de nieuwe versie klopte na twee pogingen niet');
}
async function losBestand(rows) {
  const csv = naarCsv(rows);
  const nieuw = await driveCall('create_file', { title: `Positieve ervaringen - ${vandaag()} - los`, parentId: THERAPIE_MAP, contentMimeType: 'text/csv', textContent: csv });
  return (nieuw && (nieuw.viewUrl || (nieuw.file && nieuw.file.viewUrl))) || '';
}

async function saveStaged() {
  const s = therapy.staged;
  if (!s || s.saving) return;
  s.saving = true; renderSession();
  therapy.turns.push({ role: 'note', content: 'Rosie zet ze nu in je lijst, dat duurt een minuutje.' }); renderSession();
  try {
    let L;
    try { L = s.kind === 'fill' && therapy.list ? therapy.list : await readLijst(); }
    catch (e) { L = null; s.readError = e.message; }
    if (s.kind === 'add') {
      if (!L) {                                                       // the list could not be read: leave it alone
        const url = await losBestand(s.rows);
        therapy.turns.push({ role: 'note', content: `Je lijst is ongemoeid gebleven (${s.readError}). De ervaringen van vandaag staan in een los bestand, zodat ze later samengevoegd kunnen worden.`, link: url });
      } else {
        const rijen = L.rows.concat(s.rows);
        try {
          const up = await uploadEnCheck(rijen, L.id);
          therapy.turns.push({ role: 'assistant', content: `Ze staan erin: ${s.rows.length} ${s.rows.length === 1 ? 'ervaring' : 'ervaringen'} erbij, nu ${rijen.length} in totaal.${up.opgeruimd ? '' : ' (De vorige versie kon niet naar de prullenbak; die staat er nog naast.)'}${L.meer ? ' Er stonden meer lijsten met dezelfde naam; ik heb de nieuwste aangevuld.' : ''}`, link: up.url });
        } catch (e) {
          const url = await losBestand(s.rows);
          therapy.turns.push({ role: 'note', content: `Je lijst is ongemoeid gebleven (${e.message}). De ervaringen van vandaag staan in een los bestand.`, link: url });
        }
      }
    } else {
      if (!L || !L.id) throw new Error(s.readError || 'er is geen lijst gevonden');
      const rijen = L.rows.map((r) => r.slice());
      let gevuld = 0; const overgeslagen = [];
      for (const it of s.items) {
        const i = it.rij - 2;
        if (!(i >= 0 && i < rijen.length) || rijen[i][1] !== it.ervaring) { overgeslagen.push(`rij ${it.rij}: ervaring-tekst klopt niet`); continue; }
        if (rijen[i][5]) { overgeslagen.push(`rij ${it.rij}: reflectie is al ingevuld`); continue; }
        rijen[i][5] = it.reflectie; gevuld++;
      }
      if (!gevuld) throw new Error('niets opgeslagen: ' + overgeslagen.join('; '));
      const up = await uploadEnCheck(rijen, L.id);
      const nogLeeg = rijen.filter((r) => !r[5]).length;
      therapy.turns.push({ role: 'assistant', content: `${gevuld} ${gevuld === 1 ? 'reflectie' : 'reflecties'} aangevuld; er zijn er nog ${nogLeeg} leeg.${overgeslagen.length ? ' Niet opgeslagen: ' + overgeslagen.join('; ') + '.' : ''}`, link: up.url });
    }
    therapy.staged = null; therapy.list = null;
  } catch (e) {
    s.saving = false;
    therapy.turns.push({ role: 'note', content: 'Opslaan lukte niet: ' + e.message + ' Er is niets veranderd in je lijst.' });
  }
  renderSession();
}

// ---------- the evening reminder (Harm: yes) ----------
function remindIfEvening() {
  if (!office.ready || therapy.active) return;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 19 * 60 || mins > 23 * 60 + 30) return;
  let last = '';
  try { last = localStorage.getItem('rosie-reminded') || ''; } catch (e) { /* fine */ }
  if (last === vandaag()) return;
  try { localStorage.setItem('rosie-reminded', vandaag()); } catch (e) { /* fine */ }
  document.getElementById('rosie-bar').hidden = false;
}

// ---------- wiring ----------
document.getElementById('session-send').addEventListener('click', sendSession);
document.getElementById('session-input').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !TOUCH_SCREEN.matches) { e.preventDefault(); sendSession(); } });
document.getElementById('session-end').addEventListener('click', endSession);
document.getElementById('session').addEventListener('keydown', (e) => e.stopPropagation());
document.getElementById('chat-session').addEventListener('click', startSession);
document.getElementById('rosie-yes').addEventListener('click', () => { document.getElementById('rosie-bar').hidden = true; startSession(); });
document.getElementById('rosie-no').addEventListener('click', () => { document.getElementById('rosie-bar').hidden = true; });
document.getElementById('meeting').addEventListener('click', (e) => { if (therapy.active) { e.stopImmediatePropagation(); toast('Je zit in een sessie bij Rosie. Sluit die eerst af.'); } }, true);
function updateSessionButton() { const row = document.getElementById('chat-session-row'); if (row) row.hidden = !(office.chat && office.chat.id === THERAPIST); }
setInterval(remindIfEvening, 60000);
setTimeout(remindIfEvening, 8000);
