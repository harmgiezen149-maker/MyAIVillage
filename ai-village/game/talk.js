// Talking in the village (Harm, 2026-10-31).
// - T: talk to whoever Harm is standing next to (chat box on the right). They stop and listen, and answer in their own
//   personality, knowing their job, their notes and their tasks.
// - M twice quickly: Kevin's chat box, from anywhere. A single M still turns the sound on and off.
//   Whatever Harm tells Kevin to do, Kevin passes to the right director; that conversation shows in Kevin's line
//   (left). Kevin can phone someone to come to Harm.
// - "Name, come here": that person stops and walks over. "Back to work": they go back inside their house.
// - In a meeting: a chat box on the left with everyone's names and faces. "Everyone" talks to the whole room; click a
//   name to talk to just that person. The box can be resized and the faces and names made bigger.
// - C: the village talk log: what villagers say to each other when they meet. Only real conversations (about real
//   work), made on Harm's Claude plan (smallest tier), and only once Harm has switched it on.
// Every promise to do something becomes a real task (see makeChatTask in office.js).

const PERSONALITY = {
  kevin: 'Calm, organised and quietly funny. Short, clear sentences, always one step ahead, never lets a request fall through the cracks.',
  'margot-finch': 'Brisk, warm and precise, like a seasoned postmistress. Loves a tidy inbox and a well-worded reply; a little old-fashioned in phrasing.',
  'juno-park': 'Eager, upbeat and quick. Asks good questions, loves sorting things into neat piles, proud when the inbox hits zero.',
  'theo-ashworth': 'Careful and dry-witted. Thinks in numbers, double-checks everything, gently warns about spending.',
  'felix-moss': 'Quiet, meticulous and a bit shy. Lights up about a perfectly balanced spreadsheet.',
  'imani-okafor': 'Curious and thoughtful. Explains things clearly, says where things come from, loves a good question.',
  'iris-chen': 'Sharp and friendly-sceptical. Always asks "where does that come from?" and enjoys checking facts.',
  'rafael-moreno': 'Passionate maker, full of ideas and sketches, but practical about what can really be built.',
  'otto-brandt': 'Hands-on and steady. Tests things until they break, then fixes them. Few words, solid work.',
  'rosie-bell': 'Warm, caring and organised. Remembers every birthday and fusses a little over everyone.',
  'daisy-quinn': 'Cheerful and chatty. Loves lists and colour-coded calendars.',
  'jasper-vale': 'Easy-going and lyrical, always humming something. Has a song for every mood.',
  'remy-dubois': 'Relaxed and a bit dreamy, with deep music knowledge; drops a French word now and then.',
  'nova-lindqvist': 'Quick and future-minded, with a calm Scandinavian edge. Separates hype from what really matters.',
  'kai-tanaka': 'Energetic news hound with a fresh headline ready, quick to sum things up.',
  'leo-castellano': 'Charming and diplomatic. Knows how to put things to people; persuasive but honest.',
  'sol-rivera': 'Friendly and persistent. Never forgets a follow-up and keeps everyone in the loop.',
  'greta-holm': 'No-nonsense and practical. Plans routes, times and backups, and always has a plan B.',
  'hugo-lind': 'Punctual and methodical. Knows every timetable and tracking number by heart.',
};

const talk = {
  dock: { open: false, tab: 'line' },
  line: [],            // Kevin's line: who said what to whom while passing work on
  village: [],         // village talk: conversations between villagers
  meeting: { to: 'everyone', turns: [], busy: false },
  villageOn: false,
  villageBusy: false,
  villageLastCall: -1e9,
  villagePausedUntil: 0,
  pendingResults: {},
  villageDay: { day: '', n: 0 },   // conversations made with Claude today (cap: VILLAGE_PER_DAY)   // chat id -> answers waiting for the chat to open
};
const CHAT_LIMIT = 24;
const VILLAGE_PER_DAY = 40;      // village talk with Claude: at most this many conversations a day (Harm, 2026-11-01)
function villageToday() {
  const day = new Date().toLocaleDateString('sv-SE');
  if (talk.villageDay.day !== day) {
    talk.villageDay = { day, n: 0 };
    try { const s = JSON.parse(localStorage.getItem('village-talk-day') || 'null'); if (s && s.day === day) talk.villageDay = s; } catch (e) { /* fine */ }
  }
  return talk.villageDay;
}
const COMMIT_RE = /\b(on it|i'?ll|i will|will do|i'?m on|leave it|consider it|right away|can do|got it|doing it|let me|happy to|of course|sure|okay|ok|absolutely|komt goed|komt in orde|doe ik|ga ik|ik ga|ik pak|pak ik|ik regel|regel ik|ik zorg|zorg ik|ik zet|zet ik|ik zoek|zoek ik|ik maak|maak ik|zal ik|ik zal|meteen|natuurlijk|zeker|prima|oké|is goed|geregeld|op het)\b/i;

// ---------- people ----------

function residentById(id) { return residents.find((r) => r.id === id) || null; }
function nameOf(id) { return id === 'harm' ? 'Harm' : id === 'kevin' ? KEVIN.name : (residentById(id) || { name: id }).name; }
function firstOf(id) { return nameOf(id).split(' ')[0]; }
function findPerson(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return null;
  if (w === 'kevin' || w === KEVIN.name.toLowerCase()) return 'kevin';
  for (const r of residents) {
    const n = r.name.toLowerCase();
    if (r.id === w || n === w || n.split(' ')[0] === w) return r.id;
  }
  return null;
}
function peopleNamedIn(text) {
  const t = ' ' + String(text).toLowerCase().replace(/[^a-zÀ-ɏ' -]/g, ' ') + ' ';
  return residents.filter((r) => t.includes(' ' + r.name.toLowerCase().split(' ')[0] + ' '));
}
function listNames(rs) {
  const n = rs.map((r) => r.name.split(' ')[0]);
  return n.length <= 1 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' en ' + n[n.length - 1];
}
function whereName(where) {
  if (where === 'map') return 'out in the village';
  const b = BUILDINGS.find((x) => x.room === where);
  return b ? 'in the ' + b.name : 'indoors';
}
function doingNow(r) {
  if (r.inMeeting) return 'in a meeting in the Council Hall';
  if (r.summoned) return 'walking over to talk to Harm';
  if (r.task) return `working on "${r.task}"`;
  return r.mode === 'work' ? 'at work in their house' : (r.role === 'Director' ? 'taking a break in their yard' : 'taking a walk around town');
}
function tasksOf(id) {
  return [...office.tasks.values()].filter((t) => t.owner === id || t.worker === id || (id === 'kevin'));
}
// What someone is really working on: their current task, open tasks, and what they finished today.
function workItems(r) {
  const items = [], seen = new Set();
  if (r.task) { items.push({ kind: 'now', text: r.task }); seen.add(r.task); }
  const day = new Date().toDateString();
  for (const t of tasksOf(r.id)) {
    if (seen.has(t.text)) continue;
    seen.add(t.text);
    if (t.status !== 'done') items.push({ kind: 'open', text: t.text, status: statusText(t) });
    else if (t.doneAt && new Date(t.doneAt).toDateString() === day) items.push({ kind: 'done', text: t.text, summary: t.summary });
  }
  return items.slice(0, 4);
}
function realWork(r) {
  return workItems(r).map((i) => i.kind === 'now' ? `working on "${i.text}"` : i.kind === 'open' ? `has "${i.text}" on the list (${i.status})` : `finished "${i.text}" today${i.summary ? ' (' + i.summary + ')' : ''}`).join('; ');
}
function sayWork(r) {
  const i = workItems(r)[0];
  if (!i) return 'Nu even niets.';
  return i.kind === 'now' ? `Ik werk aan "${i.text}".` : i.kind === 'open' ? `Ik heb "${i.text}" op mijn lijst.` : `Ik heb vandaag "${i.text}" afgerond.`;
}

// ---------- who they are, for Claude ----------

function personaFor(id) {
  const tasks = tasksOf(id).slice(0, 10).map((t) => `- "${t.text}" (${statusText(t)})${t.status === 'done' && t.summary ? ': ' + t.summary : ''}`).join('\n') || '- none';
  if (id === 'kevin') {
    const where = residents.map((r) => `- ${r.name} (${r.role === 'Director' ? 'director, ' + r.building.name : 'worker for ' + r.boss.name}): ${whereName(r.where)}, ${doingNow(r)}`).join('\n');
    return { model: MODELS.kevin, tier: 'complex',
      text: `You are ${KEVIN.name} (they/them), Chief of Staff to Harm (the Chief Human Officer) in Harm's AI village. ${KEVIN_BIO}
Your personality: ${PERSONALITY.kevin}
Your job: take Harm's orders and pass each one to the right director (create_task does that: you'll route it). You can phone anyone and ask them to come to Harm (call_person), and send people back to work (send_back_to_work).
The directors:
${rosterText()}
Where everyone is right now:
${where}
Tasks on Harm's list:
${tasks}` };
  }
  const r = residentById(id);
  const notes = (r.notes || []).slice(-8).map((n) => '- ' + n).join('\n') || '- none yet today';
  const who = r.role === 'Director'
    ? `You are ${r.name}, director of the ${r.building.name} (${r.building.job}) in Harm's AI village. ${r.bio} You report to ${KEVIN.name} (Chief of Staff), who reports to Harm. Your worker is ${r.workerRef.name}.`
    : `You are ${r.name}, worker (intern, yellow vest) at the ${r.building.name} (${r.building.job}) in Harm's AI village. ${r.bio} Your director is ${r.boss.name}; they check every job you do.`;
  return { model: r.role === 'Director' ? MODELS.director : MODELS.worker, tier: r.role === 'Director' ? 'complex' : 'default',
    text: `${who}
Your personality: ${PERSONALITY[id] || ''}
Right now you are ${whereName(r.where)}, ${doingNow(r)}.
Your notes from today (people you talked to):
${notes}
Your tasks:
${tasks}` };
}

// Ask one person something, with their own tools. Returns { text, created, notes }.
async function askPerson(id, turns, opts = {}) {
  const persona = personaFor(id);
  const notes = [];
  let created = null;
  const said = opts.said || '';
  const tools = [{ name: 'create_task', description: "Put a task on Harm's to-do list for you to do. Call this whenever you agree to do something Harm asks. Use Harm's own words. Returns 'created'.",
    inputSchema: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] },
    execute: async ({ task }) => { created = await makeChatTask(id, String(task), said, false, opts.from || 'chat'); return 'created'; } }];
  if (id === 'kevin') {
    tools.push(
      { name: 'call_person', description: 'Phone someone in the village and ask them to come to Harm: they stop what they are doing and walk over. Use when Harm asks you to get, call, fetch or bring someone.',
        inputSchema: { type: 'object', properties: { person: { type: 'string', description: 'their name' }, say: { type: 'string', description: 'what you say on the phone, one short sentence' } }, required: ['person'] },
        execute: async ({ person, say }) => {
          const r = residentById(findPerson(person));
          if (!r) return 'Nobody by that name lives in the village.';
          if (r.inMeeting) return `${r.name} is in the meeting already.`;
          kevinCalls(r, say);
          notes.push(`📞 ${KEVIN.name} belde ${r.name.split(' ')[0]}. ${r.name.split(' ')[0]} komt eraan.`);
          return `${r.name} is on the way.`;
        } },
      { name: 'send_back_to_work', description: "Send someone (or 'everyone') back to work: they go back inside their house.",
        inputSchema: { type: 'object', properties: { person: { type: 'string', description: "a name, or 'everyone'" } }, required: ['person'] },
        execute: async ({ person }) => {
          const list = /^(everyone|all|everybody)$/i.test(String(person).trim()) ? residents.filter((r) => r.summoned) : [residentById(findPerson(person))].filter(Boolean);
          list.forEach(backToWork);
          if (list.length) notes.push(`${listNames(list)} ${list.length > 1 ? 'gaan' : 'gaat'} weer aan het werk.`);
          return list.length ? `${listNames(list)} went back to work.` : 'Nobody to send back.';
        } });
  } else {
    const me = residentById(id);
    tools.push(
      { name: 'come_over', description: 'Walk over to Harm to talk in person.', inputSchema: { type: 'object', properties: {} },
        execute: async () => { summon(me); notes.push(`${me.name.split(' ')[0]} loopt naar je toe.`); return 'walking over'; } },
      { name: 'back_to_work', description: 'Go back to work, inside your house.', inputSchema: { type: 'object', properties: {} },
        execute: async () => { backToWork(me); notes.push(`${me.name.split(' ')[0]} gaat weer aan het werk.`); return 'back at work'; } });
  }
  const rules = `${persona.text}

${opts.context || 'Harm is talking to you in person in the village.'} Today is ${today()}.
Answer as yourself, in your own voice and personality, in Dutch: warm, short and plain (1-4 sentences). No Markdown, no lists unless asked.
${typeof memoryText === 'function' ? memoryText(id) : ''}${ACCESS_TEXT}
IMPORTANT: if Harm asks you to do something and you agree ("on it", "I'll do it"), call create_task with Harm's request in Harm's words BEFORE you reply, so a real task exists. Never pretend you already did work you haven't done: the work starts once the task exists.`;
  const msgs = [];
  for (const t of turns) {
    const role = t.role === 'user' ? 'user' : 'assistant';
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + t.content;
    else msgs.push({ role, content: t.content });
  }
  if (!msgs.length || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '(Harm walks up.)' });
  msgs[0] = { role: 'user', content: rules + '\n\n---\nHarm: ' + msgs[0].content };
  countCall(null);
  const { text } = await office.sample(msgs, { model: persona.model, modelTier: persona.tier, tools, onText: opts.onText });
  markSampleOk();
  // A promise to do something must always become a real task, even if they forgot to create it.
  if (!created && said && COMMIT_RE.test(text)) {
    countCall(null);
    const check = await office.sample.json(`Harm said to ${nameOf(id)}: "${said}"\n${nameOf(id)} replied: "${text}"\n\nDid they agree or promise to do something for Harm (e.g. "komt goed", "ik pak het op", "on it", "I'll do it")? Walking over or going back to work does not count. Reply with only JSON: {"committed": true|false, "task": "<if committed: the task in Harm's own words, as a short to-do line in Dutch>"}`, { modelTier: 'quick', cache: false }).catch(() => null);
    if (check && check.committed && check.task) created = await makeChatTask(id, String(check.task), said, true, opts.from || 'chat');
  }
  if (created) notes.push(`📋 Op je takenlijst gezet: "${created.text}"`);
  return { text, created, notes };
}

function markSampleOk() { try { localStorage.setItem('village-sample-ok', '1'); } catch (e) { /* fine */ } }
function sampleOk() { try { return localStorage.getItem('village-sample-ok') === '1'; } catch (e) { return false; } }

// ---------- walking over and going back to work ----------

function summon(r) {
  if (!r || r.inMeeting) return;
  r.summoned = true;
  r.chatting = null;
  standUp(r);
  r.plan = null; r.path = null; r.atWork = false;
  r.modeUntil = Infinity;
  r.summonWhere = null;
}
function backToWork(r) {
  if (!r) return;
  r.summoned = false;
  if (r.inMeeting) return;
  startMode(r, 'work');
  goWork(r);
  r.watching = false;
  r.noWatchUntil = state.time + 45;      // on their way: don't stop to look at Harm
  r.modeUntil = r.task ? Infinity : state.time + 60 + Math.random() * 60;
}
function kevinCalls(r, say) {
  const line = String(say || `${r.name.split(' ')[0]}, Harm wil je even spreken.`);
  state.kevin.callUntil = state.time + 6;
  office.calls.push({ a: 'kevin', b: r.id, line, until: state.time + 6 });
  lineAdd('kevin', r.id, line, 'call');
  lineAdd(r.id, 'kevin', 'Ik kom eraan.', 'say');
  setTimeout(() => summon(r), 1500);
}

// Called by residents.js each frame for someone Harm asked to come over.
function updateSummoned(r, dt) {
  if (state.meeting) { r.summoned = false; return; }
  const p = state.player, here = state.scene;
  const H = heightIn(here);
  if (r.summonWhere !== here) { r.plan = null; r.summonWhere = here; }
  if (r.where === here) {
    const d = Math.hypot(p.x - r.x, p.y - r.y);
    if (!r.plan && d < H * 1.5) { r.moving = false; setDirFrom(r, p.x - r.x, p.y - r.y); return; }
    if (r.plan && r.goal && Math.hypot(r.goal[0] - p.x, r.goal[1] - p.y) > H * 1.6 && state.time - (r.replanAt || 0) > 1.2) r.plan = null;
  }
  if (!r.plan) {
    r.replanAt = state.time;
    const side = r.where === here && r.x < p.x ? -1 : 1;
    const spot = freeSpotNear(here, p.x + side * H * 0.7, p.y + H * 0.08, r) || nearestOpenPoint(here, p.x + side * H * 0.7, p.y);
    if (!spot) return;
    planTo(r, here, spot, () => setDirFrom(r, state.player.x - r.x, state.player.y - r.y));
  }
  followPlan(r, dt);
}

// Someone Harm is talking to (chat box open) stands still and faces Harm while Harm is close.
function heldByHarm(r) {
  // Harm is walking over to them (game/visit.js): wait once Harm is close
  if (typeof visit !== 'undefined' && visit.id === r.id && !r.seated && r.where === state.scene && Math.hypot(state.player.x - r.x, state.player.y - r.y) < heightIn(r.where) * 4) return true;
  if (!office.chat || office.chat.id !== r.id || r.seated || r.where !== state.scene) return false;
  return Math.hypot(state.player.x - r.x, state.player.y - r.y) < heightIn(r.where) * 3;
}

// "Theo, come here" / "back to work": done right away in the page (free), no need to ask Claude.
function localCommand(said, chatId) {
  const come = /\bcome (here|over)\b|\bkom (eens |even |maar )?(hier|hierheen|naar mij|langs)\b/i.test(said);
  const back = /\b(get |go )?back to work\b|\b(weer |terug )?aan (het )?(werk|de slag)\b|\bterug naar (je|jullie|het) werk\b/i.test(said);
  if (!come && !back) return null;
  const named = peopleNamedIn(said);
  const everyone = /\b(everyone|everybody|all of you|iedereen|allemaal|jullie)\b/i.test(said);
  const self = chatId && chatId !== 'kevin' ? residentById(chatId) : null;
  const notes = [];
  if (come) {
    const who = named.length ? named : self ? [self] : [];
    who.forEach(summon);
    notes.push(who.length ? `${listNames(who)} ${who.length > 1 ? 'lopen' : 'loopt'} naar je toe.` : `${KEVIN.name} staat al naast je.`);
  }
  if (back) {
    const who = everyone ? residents.filter((r) => r.summoned || (r.where === state.scene && Math.hypot(state.player.x - r.x, state.player.y - r.y) < heightIn(r.where) * 3))
      : named.length ? named : self ? [self] : residents.filter((r) => r.summoned);
    who.forEach(backToWork);
    notes.push(who.length ? `${listNames(who)} ${who.length > 1 ? 'gaan' : 'gaat'} weer aan het werk.` : 'Er is hier niemand om terug te sturen.');
  }
  let rest = said.replace(/\b(please|now|come (here|over)|(get |go )?back to work|everyone|everybody|all of you|and|you|kom|eens|even|maar|hier|hierheen|naar mij|langs|weer|terug|aan|het|werk|de slag|naar|je|jullie|iedereen|allemaal|en|nu|graag|alsjeblieft|svp)\b/gi, ' ');
  for (const r of named) rest = rest.replace(new RegExp('\\b' + r.name.split(' ')[0] + '\\b', 'gi'), ' ');
  rest = rest.replace(/[^a-z0-9]+/gi, ' ').trim();
  return { note: notes.join(' '), only: rest.length < 4 };
}

// ---------- the chat box (right) ----------

async function openChat(personId, opts) {
  if (personId !== 'kevin' && !residentById(personId)) return;
  if (office.chat && office.chat.id === personId) { document.getElementById('chat').hidden = false; if (typeof setHash === 'function') setHash(linkName(personId)); focusTyping(chatInputEl()); return; }
  office.chat = { id: personId, turns: [], busy: false };
  if (typeof setHash === 'function') setHash(linkName(personId));   // the address now links to this conversation
  if (office.db) {
    try { const snap = await office.db.doc('chats/' + personId).get(); if (snap.exists) office.chat.turns = (snap.data().turns || []).slice(-CHAT_LIMIT); } catch (e) { /* new chat */ }
  }
  if (!office.chat || office.chat.id !== personId) return;
  // answers that came in while there was no storage to keep them in
  for (const turn of talk.pendingResults[personId] || []) if (!office.chat.turns.some((x) => x.taskId && x.taskId === turn.taskId)) office.chat.turns.push(turn);
  delete talk.pendingResults[personId];
  renderChat();
  document.getElementById('chat').hidden = false;
  if (!opts || !opts.quiet) focusTyping(chatInputEl());
}

// The short answer for Harm: the summary, what happened to proposed changes, and what Harm still has to do.
function resultText(t) {
  // Approvals already handled: say what happened, and drop a "please approve" note that is out of date.
  const handled = (t.approvals || []).filter((a) => a.status === 'done' || a.status === 'declined');
  const changes = handled.map((a) => `${a.status === 'done' ? '✓' : '✗'} ${a.kind === 'app' ? a.app + ': ' + a.what : (a.payload.summary || a.what)}${a.status === 'declined' ? ' (afgewezen)' : ''}`).join('\n');
  const staleNote = handled.length && !(t.approvals || []).some((a) => a.status === 'pending') && /goedkeur|keur .*goed|approve|akkoord/i.test(t.noteForHarm || '');
  const note = t.noteForHarm && !staleNote ? `\n\nVoor jou: ${t.noteForHarm}` : '';
  const warn = t.suspicious ? `\n\n⚠️ Let op: ${t.suspicious}` : '';
  const src = (t.sources || []).length ? `\n\nBronnen: ${(t.sources || []).slice(0, 4).map((x) => x.title).join(' · ')}${t.sources.length > 4 ? ` (+${t.sources.length - 4}, zie het rapport)` : ''}` : '';
  const top = (t.top3 || []).length && !/top 3/i.test(t.summary || '') ? `\n\nTop 3 voor jou:\n${t.top3.map((x, i) => `${i + 1}. ${x}`).join('\n')}` : '';
  const text = (t.outcome === 'could_not' ? 'Dit is niet gelukt. ' : '') + (t.summary || `Klaar: ${t.text}`) + top + (changes ? `\n\n${changes}` : '') + note + warn + src;
  return text;
}

// A finished task: the short answer goes back into the chat, with a link to the full PDF report.
// Asked in a conversation (or a meeting): that person answers in their chat. From the to-do list: Kevin answers.
async function postResult(t) {
  if (t.from === 'meeting' && state.meeting) {      // asked in the meeting that is still going on: answer there
    talk.meeting.turns.push({ who: t.askedPerson || 'kevin', text: resultText(t), result: true, taskId: t.id, task: t.text });
    if (office.db) office.db.doc('chats/meeting').set({ turns: talk.meeting.turns.slice(-80), updatedAt: nowStamp() }).catch(() => {});
    if (!talk.dock.open || talk.dock.tab !== 'meeting') openDock('meeting'); else renderMeeting();
    return;
  }
  const chatId = t.from === 'chat' && t.askedPerson && (t.askedPerson === 'kevin' || residentById(t.askedPerson)) ? t.askedPerson : 'kevin';   // meeting over, or from the to-do list: Kevin answers
  const text = resultText(t);
  const turn = { role: 'result', content: text, taskId: t.id, task: t.text, at: nowStamp() };
  if (office.chat && office.chat.id === chatId) {
    office.chat.turns.push(turn);
    renderChat();
    saveChat(office.chat);
    if (document.getElementById('chat').hidden) document.getElementById('chat').hidden = false;
    return;
  }
  if (office.db) {
    try {
      const snap = await office.db.doc('chats/' + chatId).get();
      const turns = snap.exists ? (snap.data().turns || []).slice() : [];   // the database copy is read-only
      turns.push(turn);
      await office.db.doc('chats/' + chatId).set({ turns: turns.slice(-CHAT_LIMIT), updatedAt: nowStamp() });
    } catch (e) { (talk.pendingResults[chatId] = talk.pendingResults[chatId] || []).push(turn); }
  } else (talk.pendingResults[chatId] = talk.pendingResults[chatId] || []).push(turn);
  if (document.getElementById('chat').hidden) openChat(chatId, { quiet: true });
  else toast(`${firstOf(chatId)} heeft antwoord op "${t.text}". Open het gesprek om het te lezen.`);
}
function closeChat() {
  document.getElementById('chat').hidden = true;
  if (typeof setHash === 'function') setHash('');
  office.chat = null;
  canvas.focus();
}
function chatInputEl() { return document.getElementById('chat-input'); }
function saveChat(c) {
  if (office.db) office.db.doc('chats/' + c.id).set({ turns: c.turns.slice(-CHAT_LIMIT), updatedAt: nowStamp() }).catch(() => {});
}

async function sendChat() {
  const c = office.chat;
  const box = chatInputEl();
  const said = box.value.trim();
  if (!c || c.busy || !said) return;
  box.value = '';
  c.turns.push({ role: 'user', content: said });
  const cmd = localCommand(said, c.id);
  if (cmd) c.turns.push({ role: 'note', content: cmd.note });
  if (cmd && cmd.only) { renderChat(); saveChat(c); return; }
  if (!office.sample) { c.turns.push({ role: 'note', content: 'Praten heeft Claude nodig: open het dorp op claude.ai.' }); renderChat(); return; }
  c.busy = true; c.streaming = '…'; renderChat();
  try {
    const res = await askPerson(c.id, c.turns.filter((t) => t.role !== 'note').slice(-CHAT_LIMIT), { said, onText: ({ text }) => { c.streaming = text; renderChat(); } });
    c.turns.push({ role: 'assistant', content: res.text });
    for (const n of res.notes) c.turns.push({ role: 'note', content: n });
  } catch (e) {
    c.turns.push({ role: 'note', content: sampleErrorText(e) });
  } finally {
    c.busy = false; c.streaming = null;
    renderChat();
    saveChat(c);
  }
}

function renderChat() {
  const c = office.chat;
  if (!c) return;
  const p = personById(c.id);
  document.getElementById('chat-face').src = `assets/portraits/${c.id}.jpg`;
  document.getElementById('chat-name').textContent = p.name;
  document.getElementById('chat-role').textContent = c.id === 'kevin' ? 'Stafchef · geef hier je opdrachten' : roleLabel(p);
  const log = document.getElementById('chat-log');
  log.innerHTML = '';
  for (const turn of c.turns) {
    const div = document.createElement('div');
    div.className = 'msg ' + (turn.role === 'user' ? 'me' : turn.role === 'note' ? 'hint' : turn.role === 'result' ? 'them result' : 'them');
    if (turn.role === 'result') {
      const head = document.createElement('div');
      head.className = 'result-head';
      head.textContent = '✓ Klaar: ' + (turn.task || '');
      const body = document.createElement('div');
      body.textContent = turn.content;
      div.append(head, body);
      const task = office.tasks.get(turn.taskId);
      if (task) {
        const link = document.createElement('button');
        link.className = 'result-link';
        link.textContent = '📄 Volledig rapport';
        link.onclick = () => showReport(task);   // first on screen; saving as a PDF is a button in there (Harm, 2026-11-02)
        div.appendChild(link);
        if (typeof feedbackRow === 'function') div.appendChild(feedbackRow(task.id));
      }
    } else div.textContent = turn.content;
    log.appendChild(div);
  }
  if (c.streaming) { const div = document.createElement('div'); div.className = 'msg them'; div.textContent = c.streaming; log.appendChild(div); }
  if (!c.turns.length && !c.streaming) {
    log.innerHTML = c.id === 'kevin'
      ? `<div class="msg hint">Vertel ${esc(KEVIN.name)} wat je nodig hebt. ${esc(KEVIN.name)} geeft het aan de juiste directeur (dat zie je in de lijn van ${esc(KEVIN.name)}), of belt iemand voor je op. "Margot, kom hier" roept iemand naar je toe.</div>`
      : `<div class="msg hint">Zeg hallo, of vraag ${esc(p.name.split(' ')[0])} iets te doen. Zeggen ze dat ze het doen, dan komt het op je takenlijst. "Weer aan het werk" stuurt ze naar huis.</div>`;
  }
  log.scrollTop = log.scrollHeight;
  document.getElementById('chat-send').disabled = c.busy;
}

// ---------- the left box: meeting, Kevin's line, village talk ----------

function openDock(tab) {
  talk.dock.open = true;
  if (tab) talk.dock.tab = tab;
  if (talk.dock.tab === 'meeting' && !state.meeting) talk.dock.tab = 'line';
  renderDock();
}
function closeDock() { talk.dock.open = false; renderDock(); canvas.focus(); }
function toggleDock(tab) { if (talk.dock.open && talk.dock.tab === tab) closeDock(); else openDock(tab); }

function face(id, cls = 'face') { return `<img class="${cls}" alt="" src="assets/portraits/${esc(id)}.jpg">`; }
function clockOf(iso) { return new Date(iso).toTimeString().slice(0, 5); }

function renderDock() {
  const dock = document.getElementById('dock');
  dock.hidden = !talk.dock.open;
  document.getElementById('tab-meeting').hidden = !state.meeting;
  for (const t of ['meeting', 'line', 'village']) {
    const on = talk.dock.tab === t;
    document.getElementById('tab-' + t).setAttribute('aria-selected', String(on));
    document.getElementById('pane-' + t).hidden = !on;
  }
  if (!talk.dock.open) return;
  if (talk.dock.tab === 'meeting') renderMeeting();
  if (talk.dock.tab === 'line') renderLine();
  if (talk.dock.tab === 'village') renderVillage();
}

// Kevin's line
function lineAdd(from, to, text, kind = 'say', taskId) {
  talk.line.push({ at: nowStamp(), from, to, text: String(text).slice(0, 800), kind, taskId: taskId || null });
  if (talk.line.length > 200) talk.line.splice(0, talk.line.length - 200);
  saveLater('logs/line', () => ({ entries: talk.line.slice(-200) }));
  if (talk.dock.open && talk.dock.tab === 'line') renderLine();
  else document.getElementById('tab-line').classList.add('fresh');
}
function renderLine() {
  document.getElementById('tab-line').classList.remove('fresh');
  const log = document.getElementById('line-log');
  if (!talk.line.length) { log.innerHTML = `<div class="msg hint">Geef je ${esc(KEVIN.name)} een opdracht, dan zie je hier de telefoontjes en overdrachten: ${esc(KEVIN.name)} naar de directeur, de directeur naar de stagiair, en de verslagen terug.</div>`; return; }
  log.innerHTML = talk.line.slice(-120).map((e) => `<div class="entry ${e.kind}">${face(e.from)}<div><div class="who">${e.kind === 'call' ? '📞 ' : ''}${esc(nameOf(e.from))} <span>→ ${esc(nameOf(e.to))} · ${clockOf(e.at)}</span></div><div class="said">${esc(e.text)}</div></div></div>`).join('');
  log.scrollTop = log.scrollHeight;
}

// Village talk
function renderVillage() {
  document.getElementById('tab-village').classList.remove('fresh');
  const btn = document.getElementById('village-toggle');
  btn.textContent = talk.villageOn ? `Dorpspraat: aan (${villageToday().n}/${VILLAGE_PER_DAY} vandaag)` : 'Dorpspraat: uit';
  btn.setAttribute('aria-pressed', String(talk.villageOn));
  const log = document.getElementById('village-log');
  if (!talk.village.length) {
    log.innerHTML = `<div class="msg hint">Komen twee dorpelingen elkaar tegen en heeft minstens één van hen echt werk te delen, dan zie je hier hun gesprek. ${talk.villageOn ? '' : 'Zet dorpspraat aan om ze echt te laten praten (het gebruikt je Claude-abonnement, kleinste model). Staat het uit, dan zie je alleen wat ze elkaar vroegen.'}</div>`;
    return;
  }
  log.innerHTML = talk.village.slice(-60).map((e) => `<div class="convo"><div class="convo-head">${face(e.a, 'face sm')}${face(e.b, 'face sm')}<span>${esc(firstOf(e.a))} & ${esc(firstOf(e.b))} · ${clockOf(e.at)}</span></div>${e.lines.map((l) => `<div class="said"><b>${esc(firstOf(l.who))}:</b> ${esc(l.text)}</div>`).join('')}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

// Called by residents.js when a worker stops to talk to someone they haven't talked to today.
function villageMet(a, b) {
  const wa = realWork(a), wb = realWork(b);
  if (!wa && !wb) return;                                    // nothing real to talk about: no conversation logged
  const entry = { at: nowStamp(), a: a.id, b: b.id, lines: [] };
  const canTalk = talk.villageOn && office.sample && sampleOk() && !talk.villageBusy && state.time > talk.villagePausedUntil && state.time - talk.villageLastCall > 30 && villageToday().n < VILLAGE_PER_DAY;
  if (canTalk) {
    talk.villageBusy = true;
    talk.villageLastCall = state.time;
    villageToday().n++;
    try { localStorage.setItem('village-talk-day', JSON.stringify(talk.villageDay)); } catch (e) { /* fine */ }
    const prompt = `Two people in Harm's AI village just met in the street.
A: ${a.name} (${a.role === 'Director' ? 'director of the ' + a.building.name : 'worker at the ' + a.building.name}). Personality: ${PERSONALITY[a.id]}. Real work: ${wa || 'nothing on right now'}.
B: ${b.name} (${b.role === 'Director' ? 'director of the ' + b.building.name : 'worker at the ' + b.building.name}). Personality: ${PERSONALITY[b.id]}. Real work: ${wb || 'nothing on right now'}.
A asks B what they're working on. Write their short conversation in Dutch (2 to 5 lines) about that real work only: what each is doing, anything useful, or how they could help each other. No filler, no invented facts beyond what is given. Each in their own voice.
Reply with only JSON: {"lines": [{"who": "a" or "b", "text": "..."}]}`;
    countCall(null);
    office.sample.json(prompt, { modelTier: 'quick', cache: false }).then((out) => {
      const lines = (out && Array.isArray(out.lines) ? out.lines : []).slice(0, 6).map((l) => ({ who: l.who === 'b' ? b.id : a.id, text: String(l.text || '').slice(0, 300) })).filter((l) => l.text);
      entry.lines = lines.length ? lines : plainLines(a, b, wa, wb);
    }).catch((e) => {
      if (e && (e.code === 'rate_limited')) talk.villagePausedUntil = state.time + 600;
      if (e && e.code === 'not_granted') { try { localStorage.removeItem('village-sample-ok'); } catch (x) { /* fine */ } }
      entry.lines = plainLines(a, b, wa, wb);
    }).finally(() => { talk.villageBusy = false; villageAdd(entry); });
  } else {
    entry.lines = plainLines(a, b, wa, wb);
    villageAdd(entry);
  }
}
function plainLines(a, b, wa, wb) {
  const lines = [{ who: a.id, text: `Waar ben je mee bezig, ${firstOf(b.id)}?` }, { who: b.id, text: sayWork(b) }];
  if (wa) lines.push({ who: a.id, text: 'En ik: ' + sayWork(a).replace(/^Ik/, 'ik') });
  return lines;
}
function villageAdd(entry) {
  talk.village.push(entry);
  if (talk.village.length > 120) talk.village.splice(0, talk.village.length - 120);
  saveLater('logs/village', () => ({ entries: talk.village.slice(-120) }));
  if (talk.dock.open && talk.dock.tab === 'village') renderVillage();
  else document.getElementById('tab-village').classList.add('fresh');
}
async function setVillageTalk(on) {
  if (on && office.sample && !sampleOk()) {
    // the first use of Claude asks Harm's OK: do it now, on Harm's click, not later by itself
    try { await office.sample('Reply with the word OK.', { modelTier: 'quick', cache: false }); markSampleOk(); }
    catch (e) { toast(sampleErrorText(e)); return; }
  }
  if (on && !office.sample) { toast('Dorpspraat heeft Claude nodig: open het dorp op claude.ai.'); }
  talk.villageOn = on && !!office.sample;
  try { localStorage.setItem('village-talk-on', talk.villageOn ? '1' : '0'); } catch (e) { /* fine */ }
  renderVillage();
}

// Meeting chat
function meetingPeople() {
  if (!state.meeting) return [];
  return ['kevin', ...MEETING.seats.map((s) => s.who).filter((id) => id !== 'harm' && id !== 'kevin'), ...residents.filter((r) => r.role === 'Worker').map((r) => r.id)]
    .filter((id) => id === 'kevin' || (residentById(id) && residentById(id).inMeeting));
}
// Under each name: what they're for, so Harm knows whom to ask (Harm, 2026-10-31).
function chipTopic(id) {
  if (id === 'kevin') return 'stafchef';
  const r = residentById(id);
  return r.role === 'Director' ? r.building.job : 'stagiair ' + r.boss.name.split(' ')[0];
}
function renderMeeting() {
  const m = talk.meeting;
  const roster = document.getElementById('meet-roster');
  const people = meetingPeople();
  roster.innerHTML = `<button class="chip ${m.to === 'everyone' ? 'on' : ''}" data-to="everyone"><span class="face all">Allen</span><span class="nm">Iedereen</span><span class="tp">de hele zaal</span></button>` +
    people.map((id) => `<button class="chip ${m.to === id ? 'on' : ''} ${residentById(id) && residentById(id).role === 'Worker' ? 'worker' : ''}" data-to="${esc(id)}">${face(id)}<span class="nm">${esc(firstOf(id))}</span><span class="tp">${esc(chipTopic(id))}</span></button>`).join('');
  const log = document.getElementById('meet-log');
  log.innerHTML = m.turns.length ? m.turns.map((t) => t.who === 'harm'
    ? `<div class="msg me">${t.to !== 'everyone' ? `<span class="to">aan ${esc(firstOf(t.to))}</span> ` : ''}${esc(t.text)}</div>`
    : t.who === 'note' ? `<div class="msg hint">${esc(t.text)}</div>`
      : t.result ? `<div class="msg them with-face result">${face(t.who, 'face sm')}<div><div class="result-head">✓ Klaar: ${esc(t.task || '')}</div><b>${esc(firstOf(t.who))}</b><br><span style="white-space:pre-wrap">${esc(t.text)}</span>${office.tasks.has(t.taskId) ? `<br><button class="result-link" data-task="${esc(t.taskId)}">📄 Volledig rapport</button><div class="fb-slot" data-task="${esc(t.taskId)}"></div>` : ''}</div></div>`
      : `<div class="msg them with-face">${face(t.who, 'face sm')}<div><b>${esc(firstOf(t.who))}</b><br>${esc(t.text)}</div></div>`).join('')
    : `<div class="msg hint">Praat met de hele zaal, of tik op een naam om alleen met die persoon te praten.</div>`;
  if (typeof feedbackRow === 'function') for (const slot of log.querySelectorAll('.fb-slot[data-task]')) slot.appendChild(feedbackRow(slot.dataset.task));
  if (m.busy) log.insertAdjacentHTML('beforeend', '<div class="msg hint">…</div>');
  log.scrollTop = log.scrollHeight;
  document.getElementById('meet-input').placeholder = m.to === 'everyone' ? 'Zeg iets tegen iedereen…' : `Zeg iets tegen ${firstOf(m.to)}…`;
  document.getElementById('meet-send').disabled = m.busy;
}
function meetingTranscript() {
  return talk.meeting.turns.filter((t) => t.who !== 'note').slice(-16).map((t) => `${t.who === 'harm' ? 'Harm' + (t.to !== 'everyone' ? ' (to ' + firstOf(t.to) + ')' : '') : nameOf(t.who)}: ${t.text}`).join('\n') || '(nothing yet)';
}
async function sendMeeting() {
  const m = talk.meeting;
  const box = document.getElementById('meet-input');
  const said = box.value.trim();
  if (!said || m.busy) return;
  box.value = '';
  const before = meetingTranscript();
  m.turns.push({ who: 'harm', to: m.to, text: said });
  if (!office.sample) { m.turns.push({ who: 'note', text: 'Praten heeft Claude nodig: open het dorp op claude.ai.' }); renderMeeting(); return; }
  m.busy = true; renderMeeting();
  try {
    if (m.to === 'everyone') {
      const people = meetingPeople();
      const roster = people.map((id) => {
        const r = residentById(id);
        const role = id === 'kevin' ? 'Chief of Staff' : r.role === 'Director' ? `director of the ${r.building.name} (${r.building.job})` : `worker for ${r.boss.name}`;
        return `- ${id}: ${nameOf(id)}, ${role}. Personality: ${PERSONALITY[id]} Working on: ${id === 'kevin' ? 'running the team' : (realWork(r) || 'nothing right now')}`;
      }).join('\n');
      const prompt = `A meeting in the Council Hall of Harm's AI village. Harm (the Chief Human Officer) sits at the head of the table and just spoke to the whole room.
In the room:
${roster}

What was said before:
${before}

Harm: "${said}"

Today is ${today()}. ${LANG_TEXT}
Write the replies (in Dutch) of the people who would naturally answer. Usually that is 1 to 4 people, most relevant first (Kevin first if Harm gave an order to the team).
BUT if Harm addresses everyone or a whole group ("iedereen", "iedere directeur", "alle directeuren", "jullie allemaal", "each director", "the workers"...), EVERY person in that group answers, each for their own area: for "every director" that is all directors in the room. Never leave someone out who was asked.
Each answers in their own voice and personality, short and plain (1-3 sentences). No invented facts about mail, calendar or apps.
If someone agrees to do something, fill "commits" with the task in Harm's words (Dutch), for their own part (the person who agrees should be the one whose area it is). When every director takes their own part, Kevin does not add an extra task for the same thing. Otherwise leave it empty.
Reply with only JSON: {"replies": [{"who": "<id from the list>", "text": "...", "commits": ""}]}`;
      countCall(null);
      const out = await office.sample.json(prompt, { model: MODELS.director, modelTier: 'complex', cache: false });
      markSampleOk();
      const replies = (out && Array.isArray(out.replies) ? out.replies : []).filter((r) => people.includes(r.who)).slice(0, people.length);
      for (const r of replies) {
        m.turns.push({ who: r.who, text: String(r.text || '') });
        let task = String(r.commits || '').trim();
        let auto = false;
        if (!task && COMMIT_RE.test(String(r.text))) {
          countCall(null);
          const check = await office.sample.json(`Harm said to the room: "${said}"\n${nameOf(r.who)} replied: "${r.text}"\n\nDid ${nameOf(r.who)} agree or promise to do something for Harm? Reply with only JSON: {"committed": true|false, "task": "<if committed: the task in Harm's own words, in Dutch>"}`, { modelTier: 'quick', cache: false }).catch(() => null);
          if (check && check.committed && check.task) { task = String(check.task); auto = true; }
        }
        if (task) { const t = await makeChatTask(r.who, task, said, auto, 'meeting'); m.turns.push({ who: 'note', text: `📋 Op je takenlijst gezet voor ${firstOf(r.who)}: "${t.text}"` }); }
      }
      if (!replies.length) m.turns.push({ who: 'note', text: 'Niemand antwoordde. Nog eens proberen?' });
    } else {
      const res = await askPerson(m.to, [{ role: 'user', content: said }], { said, from: 'meeting',
        context: `You are in a meeting in the Council Hall with Harm, ${KEVIN.name} and the team. Harm is speaking to you directly, in front of everyone. What was said so far:\n${before}` });
      m.turns.push({ who: m.to, text: res.text });
      for (const n of res.notes) m.turns.push({ who: 'note', text: n });
    }
  } catch (e) {
    m.turns.push({ who: 'note', text: sampleErrorText(e) });
  } finally {
    m.busy = false;
    if (m.turns.length > 80) m.turns.splice(0, m.turns.length - 80);
    renderMeeting();
    if (office.db) office.db.doc('chats/meeting').set({ turns: m.turns.slice(-80), updatedAt: nowStamp() }).catch(() => {});
  }
}
// meeting.js tells us when a meeting starts and ends
function meetingChatStarted() { talk.meeting.to = 'everyone'; talk.meeting.turns.push({ who: 'note', text: `Vergadering begonnen · ${new Date().toTimeString().slice(0, 5)}` }); openDock('meeting'); }
function meetingChatEnded() { if (talk.dock.tab === 'meeting') { talk.dock.tab = 'line'; if (talk.dock.open) closeDock(); } renderDock(); }

function setFaceSize(v) {
  const n = Math.max(1, Math.min(3, Number(v) || 1.5));
  const dock = document.getElementById('dock');
  dock.style.setProperty('--face', Math.round(28 + n * 22) + 'px');
  dock.style.setProperty('--name', (11 + n * 3).toFixed(1) + 'px');
  try { localStorage.setItem('village-face-size', String(n)); } catch (e) { /* fine */ }
}

// ---------- saving the logs ----------

const pendingSaves = {};
function saveLater(path, make) {
  if (!office.db || pendingSaves[path]) return;
  pendingSaves[path] = setTimeout(() => { delete pendingSaves[path]; office.db.doc(path).set({ ...make(), updatedAt: nowStamp() }).catch(() => {}); }, 1500);
}

// ---------- keys ----------

function nearestPerson() {
  const H = heightIn(state.scene), p = state.player;
  let best = null, bestD = H * 1.7;
  for (const r of residentsHere()) {
    if (r.inMeeting) continue;
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (d < bestD) { best = r.id; bestD = d; }
  }
  if (!best && Math.hypot(state.kevin.x - p.x, state.kevin.y - p.y) < H * 1.7) best = 'kevin';
  return best;
}
let lastM = 0, soundTimer = null;
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.closest && e.target.closest('input, textarea, select')) return;
  if (e.ctrlKey || e.metaKey || e.altKey || (typeof editor !== 'undefined' && editor.on)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'm') {
    if (e.repeat) return;
    const now = performance.now();
    if (now - lastM < 400) { clearTimeout(soundTimer); soundTimer = null; lastM = 0; openKevin(); return; }
    lastM = now;
    soundTimer = setTimeout(() => { soundTimer = null; toggleSound(); }, 400);
  } else if (k === 't') {
    e.preventDefault();
    if (state.meeting) { openDock('meeting'); focusTyping(document.getElementById('meet-input')); return; }
    const id = nearestPerson();
    if (!id) { toast('Loop eerst naar iemand toe en druk dan op T (of tik op iemand).'); return; }
    if (office.chat && office.chat.id === id && !document.getElementById('chat').hidden) closeChat();
    else openChat(id);
  } else if (k === 'c') {
    toggleDock('village');
  } else if (k === 'Escape') {
    if (!document.getElementById('chat').hidden) closeChat();
    else if (talk.dock.open) closeDock();
  }
});
function openKevin() {
  openChat('kevin');
  if (!state.meeting && window.innerWidth >= 700) openDock('line');   // on a phone there is no room for both: Log opens it
}

// ---------- wiring ----------

document.getElementById('dock-close').addEventListener('click', closeDock);
for (const t of ['meeting', 'line', 'village']) document.getElementById('tab-' + t).addEventListener('click', () => openDock(t));
document.getElementById('village-toggle').addEventListener('click', () => setVillageTalk(!talk.villageOn));
document.getElementById('meet-roster').addEventListener('click', (e) => {
  const b = e.target.closest('[data-to]');
  if (!b) return;
  talk.meeting.to = b.dataset.to;
  renderMeeting();
  focusTyping(document.getElementById('meet-input'));
});
document.getElementById('meet-log').addEventListener('click', (e) => {
  const b = e.target.closest('.result-link[data-task]');
  if (b && office.tasks.has(b.dataset.task)) showReport(office.tasks.get(b.dataset.task));
});
const meetInput = document.getElementById('meet-input');
meetInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); sendMeeting(); } if (e.key === 'Escape') closeDock(); });
document.getElementById('meet-send').addEventListener('click', sendMeeting);
const faceSize = document.getElementById('face-size');
faceSize.addEventListener('input', () => setFaceSize(faceSize.value));
document.getElementById('kevin-btn').addEventListener('click', openKevin);
document.getElementById('log-btn').addEventListener('click', () => toggleDock(talk.dock.open ? talk.dock.tab : 'line'));
// whichever box Harm touches comes to the front
for (const id of ['todo', 'chat', 'dock']) document.getElementById(id).addEventListener('pointerdown', (e) => { e.currentTarget.style.zIndex = String(++boxZ); });
let boxZ = 10;

(async () => {
  try { talk.villageOn = localStorage.getItem('village-talk-on') === '1'; } catch (e) { /* fine */ }
  if (window.matchMedia('(max-width: 700px)').matches) faceSize.value = '1';     // smaller faces on a phone to start with
  try { const v = localStorage.getItem('village-face-size'); if (v) faceSize.value = v; } catch (e) { /* fine */ }
  setFaceSize(faceSize.value);
  const db = window.claude && window.claude.use ? await window.claude.use('db').catch(() => null) : null;
  if (!db) return;
  try {
    const [line, village, meet] = await Promise.all(['logs/line', 'logs/village', 'chats/meeting'].map((p) => db.doc(p).get().catch(() => null)));
    if (line && line.exists) talk.line = (line.data().entries || []).concat(talk.line).slice(-200);
    if (village && village.exists) talk.village = (village.data().entries || []).concat(talk.village).slice(-120);
    if (meet && meet.exists) talk.meeting.turns = (meet.data().turns || []).concat(talk.meeting.turns).slice(-80);
  } catch (e) { /* empty logs */ }
  renderDock();
})();
renderDock();

// ---------- phones and small screens (Harm, 2026-10-31) ----------
// "☰ Meer" shows the less-used buttons; only one box is open at a time, as a sheet from the bottom.
const smallScreen = () => window.matchMedia('(max-width: 700px)').matches;
const controlsEl = document.getElementById('controls');
const moreBtn = document.getElementById('more-btn');
moreBtn.addEventListener('click', () => {
  const open = !controlsEl.classList.contains('open');
  controlsEl.classList.toggle('open', open);
  moreBtn.setAttribute('aria-expanded', String(open));
});
// tapping one of the extra buttons closes the menu again
for (const b of controlsEl.querySelectorAll('.extra')) b.addEventListener('click', () => {
  if (smallScreen() && b.id !== 'zoom-in' && b.id !== 'zoom-out') { controlsEl.classList.remove('open'); moreBtn.setAttribute('aria-expanded', 'false'); }
});
const SHEETS = {
  todo: () => document.getElementById('todo-close').click(),
  chat: () => closeChat(),
  dock: () => closeDock(),
  people: () => { document.getElementById('people').hidden = true; document.getElementById('people-btn').setAttribute('aria-pressed', 'false'); },
  profile: () => { document.getElementById('profile').hidden = true; document.getElementById('profile-btn').setAttribute('aria-pressed', 'false'); },
};
// Escape closes the box that has the keyboard focus, also when the focus is on a button in it (verbeterplan E3).
for (const [id, close] of Object.entries(SHEETS)) document.getElementById(id).addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.target.matches('input, textarea')) return;   // the text boxes handle Escape themselves
  e.stopPropagation();
  close();
  canvas.focus();
});
const sheetWatch = new MutationObserver((changes) => {
  if (!smallScreen()) return;
  for (const c of changes) {
    if (c.target.hidden) continue;
    for (const [id, close] of Object.entries(SHEETS)) if (id !== c.target.id && !document.getElementById(id).hidden) close();
    controlsEl.classList.remove('open');
  }
});
for (const id of Object.keys(SHEETS)) sheetWatch.observe(document.getElementById(id), { attributes: true, attributeFilter: ['hidden'] });
