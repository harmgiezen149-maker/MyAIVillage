// The office: Harm's to-do list, Kevin passing tasks on, directors and workers doing the work,
// talking to anyone in the village, and approvals.
//
// Everything runs in this page, on Harm's own Claude plan (the `sample` capability) and Harm's own
// claude.ai connectors (the `mcp` capability: Gmail and Google Calendar). No API keys, no pay-per-use.
// It only runs while the page is open, and only because Harm did something (added a task, sent a
// message, clicked Continue or Approve).
//
// Access (Harm, 2026-10-31):
// - Gmail: read and search mail, write drafts. Never send, delete or label.
// - Google Calendar: read freely. Adding or changing an event is proposed first and only saved after
//   Harm clicks Approve. Never delete.
// Models (Harm): Kevin and the directors on Opus 5.5 (directors can ask an advisor on Fable 5.1),
// workers on Sonnet 5.5.

const MODELS = { kevin: 'claude-opus-5-5', director: 'claude-opus-5-5', worker: 'claude-sonnet-5-5', advisor: 'claude-fable-5-1' };
const GMAIL = 'Gmail', CAL = 'Google Calendar';

const office = {
  tasks: new Map(),       // id -> task
  running: new Set(),     // ids being worked on in this visit
  calls: [],              // who is on the phone with whom (for the portraits)
  chat: null,             // the open conversation
  db: null, sample: null, mcp: null, downloads: null,
  ready: false,
};

// ---------- helpers ----------

function nowStamp() { return new Date().toISOString(); }
function timeOf(iso) { return new Date(iso).toTimeString().slice(0, 5); }
function newId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function personById(id) { return id === 'kevin' ? { id: 'kevin', name: KEVIN.name, role: 'Kevin' } : residents.find((r) => r.id === id); }
function firstName(id) { const p = personById(id); return p ? p.name.split(' ')[0] : id; }
function compact(value, max = 9000) {
  let s;
  try { s = typeof value === 'string' ? value : JSON.stringify(value); } catch (e) { s = String(value); }
  return s.length > max ? s.slice(0, max) + ' …(cut short)' : s;
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function rosterText() {
  return DIRECTORS.map((d) => {
    const r = residents.find((x) => x.id === d.id), w = residents.find((x) => x.id === d.worker.id);
    return `- ${d.id}: ${r.name}, director of the ${r.building.name} (${r.building.job}). ${r.bio} Worker: ${w.name}.`;
  }).join('\n');
}

const ACCESS_TEXT = `What the team can do with Harm's accounts:
- Gmail: search and read mail, and write DRAFTS (they land in Harm's Drafts folder). Nobody sends, deletes or labels mail.
- Google Calendar: read events freely. To add or change an event, PROPOSE it; it is saved only after Harm clicks Approve. Nobody deletes events.
Never invent facts about mail or events: look them up with the tools. If something can't be done with these tools, say so plainly.`;

function today() { return new Date().toString().slice(0, 24); }

// ---------- storage ----------

async function saveTask(t) {
  t.updatedAt = nowStamp();
  office.tasks.set(t.id, t);
  renderTodo();
  if (!office.db) return;
  t._saving = (t._saving || Promise.resolve()).then(() => office.db.doc('tasks/' + t.id).set(JSON.parse(JSON.stringify({ ...t, _saving: undefined })))).catch(() => {});
  await t._saving;
}

function logStep(t, who, text, extra) {
  t.log = t.log || [];
  t.log.push({ at: nowStamp(), who, text: String(text).slice(0, 600), ...(extra || {}) });
  if (t.log.length > 120) t.log.splice(0, t.log.length - 120);
}

// ---------- creating tasks ----------

// from: 'todo' (typed into the to-do list) or 'chat' (someone said they'd do it)
async function createTask(text, from = 'todo', opts = {}) {
  const t = {
    id: newId(), text: text.trim(), from, words: opts.words || text.trim(), createdAt: nowStamp(),
    status: 'new', owner: opts.owner || null, worker: null, askedPerson: opts.askedPerson || null,
    log: [], drafts: [], approvals: [], results: [], whatWasDone: [], summary: '',
  };
  logStep(t, 'harm', from === 'todo' ? `Harm added "${t.text}" to the to-do list.` : `Harm asked ${firstName(opts.askedPerson)}: "${t.words}"`);
  if (opts.autoCreated) logStep(t, 'office', `${firstName(opts.askedPerson)} said they'd do it, so the task was created from Harm's words.`);
  await saveTask(t);
  runTask(t);
  return t;
}

// ---------- the work ----------

async function runTask(t) {
  if (office.running.has(t.id)) return;
  if (!office.sample) { t.status = 'paused'; t.pauseReason = 'Claude is not available on this page view.'; await saveTask(t); return; }
  office.running.add(t.id);
  try {
    if (!t.owner || t.status === 'new') await kevinRoutes(t);
    if (t.status !== 'needs_harm' && t.status !== 'done') await directorWorks(t);
    await finishIfReady(t);
  } catch (e) {
    t.status = 'paused';
    t.pauseReason = sampleErrorText(e);
    logStep(t, 'office', 'Paused: ' + t.pauseReason);
    await saveTask(t);
  } finally {
    office.running.delete(t.id);
    releasePeople(t);
    renderTodo();
  }
}

function sampleErrorText(e) {
  const code = e && e.code;
  if (code === 'not_granted') return 'Using Claude was not allowed for this page. Allow it when claude.ai asks, then click Continue.';
  if (code === 'rate_limited') return 'Your Claude usage limit or the page\'s call limit was reached. Try Continue again a bit later.';
  if (code === 'cancelled') return 'Stopped.';
  if (code === 'session_expired') return 'Please sign in to claude.ai again, then click Continue.';
  if (code === 'tools_unavailable') return 'This view of the page can\'t let Claude use tools. Open the village on claude.ai.';
  return (e && e.message ? e.message : 'Something went wrong') + (code ? ` (${code})` : '');
}

// Kevin reads the task and calls the right director.
async function kevinRoutes(t) {
  t.status = 'kevin';
  logStep(t, 'kevin', 'Kevin is reading the task.');
  await saveTask(t);
  let owner = t.owner;
  let brief = '';
  if (!owner || t.askedPerson === 'kevin') {
    const prompt = `You are Kevin, Chief of Staff to Harm (the Chief Human Officer) in Harm's AI village. Harm just put this on the to-do list:

"${t.text}"

Today is ${today()}. The directors:
${rosterText()}

Pick the ONE director whose area fits best. Write them a short brief: what Harm wants, what "done" looks like, anything to watch out for.
${ACCESS_TEXT}

Reply with only JSON: {"director": "<director id from the list>", "why": "<one sentence>", "brief": "<2-5 sentences>", "callLine": "<the first thing you say on the phone, one short sentence>"}`;
    const out = await office.sample.json(prompt, { model: MODELS.kevin, modelTier: 'complex', effort: 'low', cache: false });
    owner = DIRECTORS.some((d) => d.id === out.director) ? out.director : DIRECTORS[0].id;
    brief = String(out.brief || '');
    t.kevinWhy = String(out.why || '');
    logStep(t, 'kevin', `Kevin picked ${firstName(owner)}: ${t.kevinWhy}`);
    startCall('kevin', owner, String(out.callLine || `Hi ${firstName(owner)}, Harm has something for you.`));
    logStep(t, 'kevin', `Kevin called ${firstName(owner)}: "${out.callLine || ''}"`);
  } else {
    brief = `Harm asked ${firstName(owner)} directly.`;
  }
  t.owner = owner;
  t.brief = brief;
  t.status = 'assigned';
  await saveTask(t);
}

function startCall(a, b, line) {
  office.calls.push({ a, b, line, until: state.time + 9 });
  if (a === 'kevin' || b === 'kevin') state.kevin.callUntil = state.time + 9;
}

// Send someone to work on the task in the village (they walk home to their desk or spot).
function busyWith(r, t) {
  if (!r) return;
  r.task = t.text;
  r.taskId = t.id;
  if (!r.inMeeting && r.mode !== 'work') { startMode(r, 'work'); goWork(r); }
  r.modeUntil = Infinity;
}
function releasePeople(t) {
  for (const r of residents) if (r.taskId === t.id) { r.task = null; r.taskId = null; r.modeUntil = state.time + 15 + Math.random() * 20; }
}

// The tools the team can use: Gmail, Calendar, notes. Each one is written into the task's log.
function teamTools(t, who) {
  const name = firstName(who);
  const call = async (server, tool, input, ctx) => {
    if (!office.mcp) throw new Error(`${server} is not available on this page view.`);
    try {
      const res = await office.mcp.callTool(server, tool, input, { signal: ctx && ctx.signal });
      return res.payload !== undefined ? res.payload : res.content;
    } catch (e) {
      const why = { needs_reauth: `reconnect ${server} in claude.ai Settings → Connectors`, server_not_connected: `${server} isn't connected in claude.ai Settings → Connectors`,
        not_in_manifest: `Harm hasn't allowed ${server} for this page`, approval_required: `Harm needs to approve ${server} for this page` }[e.code];
      throw new Error(why || `${server} said: ${e.message || e.code}`);
    }
  };
  return [
    { name: 'note', description: 'Write a short progress note that Harm can see (what you are doing now). Returns "ok".',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      execute: async ({ text }) => { logStep(t, who, String(text)); saveTask(t); return 'ok'; } },
    { name: 'gmail_search', description: "Search Harm's Gmail with Gmail query syntax (e.g. 'is:unread in:inbox newer_than:2d', 'from:anna subject:invoice'). Returns threads with id, subject, sender, date and a snippet.",
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, max: { type: 'number' } }, required: ['query'] },
      execute: async ({ query, max }, ctx) => {
        logStep(t, who, `${name} searched Gmail for "${query}".`, { tool: 'gmail_search' });
        return compact(await call(GMAIL, 'search_threads', { query: String(query), pageSize: Math.min(20, Number(max) || 10), view: 'THREAD_VIEW_SUMMARY' }, ctx), 12000);
      } },
    { name: 'gmail_read_thread', description: 'Read one Gmail thread in full (plain text). Use the thread id from gmail_search.',
      inputSchema: { type: 'object', properties: { threadId: { type: 'string' } }, required: ['threadId'] },
      execute: async ({ threadId }, ctx) => {
        logStep(t, who, `${name} read an email thread.`, { tool: 'gmail_read_thread' });
        return compact(await call(GMAIL, 'get_thread', { threadId: String(threadId), messageFormat: 'PLAIN_TEXT' }, ctx), 16000);
      } },
    { name: 'gmail_list_drafts', description: "List Harm's existing Gmail drafts (optionally filtered with a Gmail query).",
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      execute: async ({ query }, ctx) => compact(await call(GMAIL, 'list_drafts', { query: query ? String(query) : undefined, view: 'DRAFT_VIEW_FULL', pageSize: 10 }, ctx), 10000) },
    { name: 'gmail_create_draft', description: "Write an email DRAFT in Harm's Gmail (it is not sent; Harm sends it). For a reply, pass replyToMessageId. Plain-text body, no Markdown. Returns the draft's id and link.",
      inputSchema: { type: 'object', properties: { to: { type: 'array', items: { type: 'string' } }, cc: { type: 'array', items: { type: 'string' } }, subject: { type: 'string' }, body: { type: 'string' }, replyToMessageId: { type: 'string' } }, required: ['body'] },
      execute: async (input, ctx) => {
        const args = { body: String(input.body) };
        if (Array.isArray(input.to)) args.to = input.to.map(String);
        if (Array.isArray(input.cc)) args.cc = input.cc.map(String);
        if (input.subject) args.subject = String(input.subject);
        if (input.replyToMessageId) args.replyToMessageId = String(input.replyToMessageId);
        const out = await call(GMAIL, 'create_draft', args, ctx);
        const d = { at: nowStamp(), by: who, to: args.to || [], subject: args.subject || '(reply)', body: args.body.slice(0, 3000), url: out && (out.viewUrl || (out.draft && out.draft.viewUrl)) || '', id: out && (out.id || (out.draft && out.draft.id)) || '' };
        t.drafts.push(d);
        logStep(t, who, `${name} wrote a draft: "${d.subject}"${d.to.length ? ' to ' + d.to.join(', ') : ''}.`, { tool: 'gmail_create_draft', link: d.url });
        await saveTask(t);
        return compact(out, 2000);
      } },
    { name: 'calendar_list_events', description: "List events on Harm's calendar between two local times (ISO 8601 without offset, e.g. 2026-11-02T00:00:00). Optional text filter.",
      inputSchema: { type: 'object', properties: { startTime: { type: 'string' }, endTime: { type: 'string' }, text: { type: 'string' } } },
      execute: async ({ startTime, endTime, text }, ctx) => {
        logStep(t, who, `${name} looked at the calendar${startTime ? ' from ' + String(startTime).slice(0, 10) : ''}${endTime ? ' to ' + String(endTime).slice(0, 10) : ''}.`, { tool: 'calendar_list_events' });
        const args = { orderBy: 'startTime', pageSize: 40 };
        if (startTime) args.startTime = String(startTime);
        if (endTime) args.endTime = String(endTime);
        if (text) args.fullText = String(text);
        return compact(await call(CAL, 'list_events', args, ctx), 14000);
      } },
    { name: 'calendar_search', description: "Search Harm's calendar for events by topic or words.",
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      execute: async ({ query }, ctx) => {
        logStep(t, who, `${name} searched the calendar for "${query}".`, { tool: 'calendar_search' });
        return compact(await call(CAL, 'search_events', { query: String(query), pageSize: 20 }, ctx), 12000);
      } },
    { name: 'calendar_propose_event', description: "Propose a NEW calendar event. It is NOT saved yet: Harm sees it and approves or declines. Times are local ISO 8601 without offset.",
      inputSchema: { type: 'object', properties: { summary: { type: 'string' }, startTime: { type: 'string' }, endTime: { type: 'string' }, description: { type: 'string' }, location: { type: 'string' }, allDay: { type: 'boolean' } }, required: ['summary', 'startTime', 'endTime'] },
      execute: async (input) => {
        const payload = { summary: String(input.summary), startTime: String(input.startTime), endTime: String(input.endTime) };
        if (input.description) payload.description = String(input.description);
        if (input.location) payload.location = String(input.location);
        if (input.allDay) payload.allDay = true;
        t.approvals.push({ id: newId(), kind: 'create_event', by: who, payload, status: 'pending', at: nowStamp() });
        logStep(t, who, `${name} proposed a calendar event: "${payload.summary}", ${payload.startTime.replace('T', ' ').slice(0, 16)}. Waiting for Harm's OK.`);
        await saveTask(t);
        return 'Proposed. It will be added only after Harm approves it.';
      } },
    { name: 'calendar_propose_change', description: "Propose a CHANGE to an existing event (new time, title, place or description). Not saved until Harm approves. Needs the eventId from the calendar tools.",
      inputSchema: { type: 'object', properties: { eventId: { type: 'string' }, summary: { type: 'string' }, startTime: { type: 'string' }, endTime: { type: 'string' }, description: { type: 'string' }, location: { type: 'string' }, what: { type: 'string', description: 'one line: what changes and why' } }, required: ['eventId', 'what'] },
      execute: async (input) => {
        const payload = { eventId: String(input.eventId) };
        for (const k of ['summary', 'startTime', 'endTime', 'description', 'location']) if (input[k]) payload[k] = String(input[k]);
        t.approvals.push({ id: newId(), kind: 'update_event', by: who, payload, what: String(input.what || ''), status: 'pending', at: nowStamp() });
        logStep(t, who, `${name} proposed a calendar change: ${input.what}. Waiting for Harm's OK.`);
        await saveTask(t);
        return 'Proposed. It will be changed only after Harm approves it.';
      } },
  ];
}

const RESULT_SHAPE = `When you are finished, reply with only JSON:
{"status": "done" | "could_not",
 "summary": "<2-4 sentences for Harm: what was done and the outcome>",
 "whatWasDone": ["<each concrete step, past tense, specific>", "..."],
 "results": [{"title": "<short>", "body": "<the actual result: findings, the text of a draft, the proposed event, numbers, links>"}],
 "noteForHarm": "<anything Harm must do next, e.g. send the draft or approve the event; empty if nothing>"}`;

// The director does the task, or hands it to their worker and checks the work.
async function directorWorks(t) {
  const d = residents.find((r) => r.id === t.owner);
  const w = d.workerRef;
  t.status = 'working';
  busyWith(d, t);
  logStep(t, d.id, `${firstName(d.id)} is on it.`);
  await saveTask(t);

  const tools = teamTools(t, d.id).concat([
    { name: 'hand_to_worker', description: `Give the job (or a part of it) to your worker ${w.name}, with clear instructions. ${firstName(w.id)} uses the same Gmail and Calendar tools and reports back; you then CHECK the work. Returns ${firstName(w.id)}'s report.`,
      inputSchema: { type: 'object', properties: { instructions: { type: 'string' } }, required: ['instructions'] },
      execute: async ({ instructions }, ctx) => workerDoes(t, d, w, String(instructions), ctx) },
    { name: 'ask_advisor', description: 'Ask your advisor (a more senior model) for a second opinion on something hard: a tricky judgement, wording, or a plan. Returns their advice.',
      inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
      execute: async ({ question }) => {
        logStep(t, d.id, `${firstName(d.id)} asked the advisor for a second opinion.`);
        const { text } = await office.sample(`You are a senior advisor to ${d.name}, a director in Harm's AI village. Give short, practical advice.\n\nThe task: ${t.text}\n\nQuestion: ${question}`, { model: MODELS.advisor, modelTier: 'complex', cache: false });
        return text.slice(0, 4000);
      } },
  ]);
  const prompt = `You are ${d.name}, director of the ${d.building.name} in Harm's AI village. ${d.bio}
You report to Kevin (Chief of Staff), who reports to Harm (the Chief Human Officer). Your worker is ${w.name} (${w.bio}). Workers are like interns: every job comes from you and you check all their work before it counts.

Kevin just called you with this task from Harm's to-do list:
TASK: ${t.text}
${t.words !== t.text ? `HARM'S OWN WORDS: ${t.words}\n` : ''}KEVIN'S BRIEF: ${t.brief || '-'}

Today is ${today()}.
${ACCESS_TEXT}

Do the task properly with the tools: do it yourself, or hand it (or a part) to ${firstName(w.id)} with hand_to_worker and then check what comes back. Use note to tell Harm what you're doing at each main step. Keep it to what the task needs.
${RESULT_SHAPE}`;
  const out = await office.sample.json(prompt, { model: MODELS.director, modelTier: 'complex', effort: 'medium', tools });
  t.summary = String(out.summary || '');
  t.whatWasDone = Array.isArray(out.whatWasDone) ? out.whatWasDone.map(String) : [];
  t.results = Array.isArray(out.results) ? out.results.map((r) => ({ title: String(r.title || ''), body: String(r.body || '') })) : [];
  t.noteForHarm = String(out.noteForHarm || '');
  t.outcome = out.status === 'could_not' ? 'could_not' : 'done';
  logStep(t, d.id, `${firstName(d.id)} finished: ${t.summary}`);
  t.status = t.approvals.some((a) => a.status === 'pending') ? 'needs_harm' : 'finishing';
  await saveTask(t);
}

async function workerDoes(t, d, w, instructions, ctx) {
  t.worker = w.id;
  busyWith(w, t);
  startCall(d.id, w.id, `${firstName(w.id)}, can you take this?`);
  logStep(t, d.id, `${firstName(d.id)} handed it to ${firstName(w.id)}: ${instructions}`);
  await saveTask(t);
  const prompt = `You are ${w.name}, worker at the ${d.building.name} in Harm's AI village (${w.bio}). Your director ${d.name} gave you this job:
${instructions}

(It is part of Harm's task: ${t.text})
Today is ${today()}.
${ACCESS_TEXT}

Do it with the tools. Use note for your main steps. When done, reply with a clear report for ${firstName(d.id)}: what you did, what you found or made (include draft subjects, event details, key facts), and anything you couldn't do.`;
  const { text } = await office.sample(prompt, { model: MODELS.worker, modelTier: 'default', effort: 'medium', tools: teamTools(t, w.id), signal: ctx && ctx.signal });
  logStep(t, w.id, `${firstName(w.id)} reported back to ${firstName(d.id)}.`);
  t.workerReports = (t.workerReports || []).concat([{ at: nowStamp(), text: text.slice(0, 6000) }]);
  await saveTask(t);
  logStep(t, d.id, `${firstName(d.id)} is checking ${firstName(w.id)}'s work.`);
  return text.slice(0, 12000);
}

async function finishIfReady(t) {
  if (t.status === 'needs_harm' || t.status === 'paused' || t.status === 'kevin' || t.status === 'new') return;
  if (t.approvals.some((a) => a.status === 'pending')) { t.status = 'needs_harm'; await saveTask(t); return; }
  if (t.status !== 'finishing' && t.status !== 'working') return;
  t.status = 'done';
  t.doneAt = nowStamp();
  logStep(t, 'kevin', `Kevin crossed it off the list.`);
  await saveTask(t);
  releasePeople(t);
  toast(`Done: ${t.text}`);
  offerReport(t);
}

// ---------- approvals (Harm clicks Approve or Decline) ----------

async function decide(taskId, apId, approve) {
  const t = office.tasks.get(taskId);
  const ap = t && t.approvals.find((a) => a.id === apId);
  if (!ap || ap.status !== 'pending') return;
  ap.status = approve ? 'approving' : 'declined';
  renderTodo();
  if (approve) {
    try {
      const tool = ap.kind === 'create_event' ? 'create_event' : 'update_event';
      const res = await office.mcp.callTool(CAL, tool, ap.payload);
      const out = res.payload || {};
      ap.status = 'done';
      ap.url = out.htmlLink || out.viewUrl || (out.event && (out.event.htmlLink || out.event.viewUrl)) || '';
      logStep(t, 'harm', `Harm approved: ${ap.kind === 'create_event' ? 'added' : 'changed'} "${ap.payload.summary || ap.what}" in the calendar.`, { link: ap.url });
    } catch (e) {
      ap.status = 'pending';
      logStep(t, 'office', `The calendar didn't take it: ${e.message || e.code}. You can try Approve again.`);
      await saveTask(t);
      return;
    }
  } else {
    logStep(t, 'harm', `Harm declined: "${ap.payload.summary || ap.what}".`);
  }
  if (!t.approvals.some((a) => a.status === 'pending')) t.status = 'finishing';
  await saveTask(t);
  await finishIfReady(t);
}

// ---------- the PDF report ----------

async function offerReport(t) {
  if (typeof makeTaskReport !== 'function') return;
  try {
    const blob = await makeTaskReport(t);
    if (!office.downloads) { toast('The report is ready, but this view can\'t save files.'); return; }
    const safe = t.text.replace(/[^A-Za-z0-9 _-]+/g, '').trim().slice(0, 50) || 'task';
    await office.downloads.save({ filename: `Task report - ${safe}.pdf`, data: blob });
  } catch (e) {
    if (e && e.code === 'declined') return;
    toast('Could not make the report: ' + (e && (e.message || e.code)));
  }
}

// ---------- talking to people ----------

const CHAT_LIMIT = 24;
async function openChat(personId) {
  const p = personById(personId);
  if (!p) return;
  office.chat = { id: personId, turns: [], busy: false };
  if (office.db) {
    try { const snap = await office.db.doc('chats/' + personId).get(); if (snap.exists) office.chat.turns = (snap.data().turns || []).slice(-CHAT_LIMIT); } catch (e) { /* new chat */ }
  }
  renderChat();
  document.getElementById('chat').hidden = false;
  document.getElementById('chat-input').focus();
}

function personaFor(id) {
  if (id === 'kevin') return { model: MODELS.kevin, text: `You are Kevin (they/them), Chief of Staff to Harm (the Chief Human Officer) in Harm's AI village. ${KEVIN_BIO} You take Harm's orders and pass them on to the right director. The directors:\n${rosterText()}` };
  const r = residents.find((x) => x.id === id);
  if (r.role === 'Director') return { model: MODELS.director, text: `You are ${r.name}, director of the ${r.building.name} in Harm's AI village. ${r.bio} You report to Kevin (Chief of Staff), who reports to Harm. Your worker is ${r.workerRef.name}.` };
  return { model: MODELS.worker, text: `You are ${r.name}, worker (intern) at the ${r.building.name} in Harm's AI village. ${r.bio} Your director is ${r.boss.name}; every job you do is checked by them.` };
}

function openTasksFor(id) {
  return [...office.tasks.values()].filter((t) => t.status !== 'done' && (t.owner === id || t.worker === id || (id === 'kevin'))).slice(0, 8)
    .map((t) => `- "${t.text}" (${statusText(t)})`).join('\n') || '- none';
}

async function sendChat() {
  const c = office.chat;
  const box = document.getElementById('chat-input');
  const said = box.value.trim();
  if (!c || c.busy || !said) return;
  if (!office.sample) { toast('Talking needs Claude, which is not available in this view.'); return; }
  box.value = '';
  c.turns.push({ role: 'user', content: said });
  c.busy = true; c.streaming = '…'; renderChat();
  const persona = personaFor(c.id);
  let created = null;
  const tools = [{ name: 'create_task', description: "Put a task on Harm's to-do list for YOU to do. Call this whenever you agree to do something Harm asks. Use Harm's own words. Returns 'created'.",
    inputSchema: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] },
    execute: async ({ task }) => { created = await makeChatTask(c.id, String(task), said, false); return 'created'; } }];
  const rules = `${persona.text}

Harm is talking to you in the village. Today is ${today()}. Answer in character: warm, short, plain words (2-4 sentences).
${ACCESS_TEXT}
Your open tasks:
${openTasksFor(c.id)}

IMPORTANT: if Harm asks you to do something and you agree ("on it", "I'll do it", "will do"), call create_task with Harm's request in Harm's words BEFORE you reply, so a real task exists. Don't pretend to have done work you haven't done; the actual work starts once the task exists.`;
  const turns = [{ role: 'user', content: rules }, ...c.turns.slice(-CHAT_LIMIT)];
  try {
    const { text } = await office.sample(turns, { model: persona.model, modelTier: personById(c.id).role === 'Worker' ? 'default' : 'complex', effort: 'low', tools, onText: ({ text }) => { c.streaming = text; renderChat(); } });
    c.turns.push({ role: 'assistant', content: text });
    // A promise to do something must always become a real task, even if they forgot to create it.
    if (!created) {
      const check = await office.sample.json(`Harm said to ${personById(c.id).name}: "${said}"\n${personById(c.id).name} replied: "${text}"\n\nDid they agree or promise to do something for Harm (e.g. "on it", "I'll do it", "will do", "sure, I'll...")? Reply with only JSON: {"committed": true|false, "task": "<if committed: the task in Harm's own words, as a short to-do line>"}`, { modelTier: 'quick', cache: false }).catch(() => null);
      if (check && check.committed && check.task) created = await makeChatTask(c.id, String(check.task), said, true);
    }
    if (created) c.turns.push({ role: 'assistant', content: `📋 Added to your to-do list: "${created.text}"` });
  } catch (e) {
    c.turns.push({ role: 'assistant', content: '(' + sampleErrorText(e) + ')' });
  } finally {
    c.busy = false; c.streaming = null;
    renderChat();
    if (office.db) office.db.doc('chats/' + c.id).set({ turns: c.turns.slice(-CHAT_LIMIT), updatedAt: nowStamp() }).catch(() => {});
  }
}

// A task from a conversation goes straight to the person who said they'd do it (Kevin's go through Kevin).
async function makeChatTask(personId, task, words, autoCreated) {
  const p = personById(personId);
  const owner = personId === 'kevin' ? null : (p.role === 'Director' ? p.id : p.boss.id);
  const t = await createTask(task, 'chat', { words, owner, askedPerson: personId, autoCreated });
  if (p.role === 'Worker') t.brief = `Harm asked ${p.name} directly; hand it to ${firstName(p.id)} and check the work.`;
  return t;
}

// ---------- the to-do panel ----------

function statusText(t) {
  const who = t.owner ? firstName(t.owner) : 'Kevin';
  return ({ new: 'New', kevin: 'Kevin is on it', assigned: `With ${who}`, working: t.worker ? `${firstName(t.worker)} is working, ${who} checks` : `${who} is working on it`,
    needs_harm: 'Needs your OK', finishing: 'Wrapping up', done: 'Done', paused: 'Paused' })[t.status] || t.status;
}

function renderTodo() {
  const list = document.getElementById('todo-list');
  if (!list) return;
  const tasks = [...office.tasks.values()].sort((a, b) => (a.status === 'done') - (b.status === 'done') || b.createdAt.localeCompare(a.createdAt));
  const open = tasks.filter((t) => t.status !== 'done').length;
  const badge = document.getElementById('todo-count');
  badge.textContent = open ? String(open) : '';
  badge.hidden = !open;
  list.innerHTML = '';
  let reshow = null;
  if (!tasks.length) { list.innerHTML = '<li class="todo-empty">Nothing yet. Type a task above and press Enter: Kevin passes it to the right director.</li>'; return; }
  for (const t of tasks) {
    const li = document.createElement('li');
    li.className = 'todo-item ' + t.status;
    li.innerHTML = `<div class="todo-row"><span class="todo-check" aria-hidden="true">${t.status === 'done' ? '✓' : ''}</span>
      <span class="todo-text">${esc(t.text)}</span></div>
      <div class="todo-meta">${esc(statusText(t))}${t.from === 'chat' ? ` · asked ${esc(firstName(t.askedPerson))} in person` : ''}${t.status === 'done' ? ' · ' + esc(timeOf(t.doneAt)) : ''}</div>`;
    const last = (t.log || []).slice(-1)[0];
    if (t.status !== 'done' && last) li.insertAdjacentHTML('beforeend', `<div class="todo-latest">${esc(last.text)}</div>`);
    if (t.status === 'paused') {
      li.insertAdjacentHTML('beforeend', `<div class="todo-latest">${esc(t.pauseReason || '')}</div>`);
      const b = document.createElement('button'); b.textContent = 'Continue'; b.className = 'small';
      b.onclick = () => { t.status = t.owner ? 'assigned' : 'new'; saveTask(t); runTask(t); };
      li.appendChild(b);
    }
    for (const ap of (t.approvals || []).filter((a) => a.status === 'pending' || a.status === 'approving')) {
      const p = ap.payload;
      const box = document.createElement('div');
      box.className = 'todo-approval';
      box.innerHTML = `<div><b>${ap.kind === 'create_event' ? 'Add to calendar' : 'Change event'}:</b> ${esc(p.summary || ap.what || '')}</div>
        <div class="todo-meta">${esc((p.startTime || '').replace('T', ' ').slice(0, 16))}${p.endTime ? ' – ' + esc(p.endTime.slice(11, 16)) : ''}${p.location ? ' · ' + esc(p.location) : ''}</div>`;
      const ok = document.createElement('button'); ok.textContent = ap.status === 'approving' ? 'Saving…' : 'Approve'; ok.className = 'small primary'; ok.disabled = ap.status === 'approving';
      ok.onclick = () => decide(t.id, ap.id, true);
      const no = document.createElement('button'); no.textContent = 'Decline'; no.className = 'small'; no.disabled = ap.status === 'approving';
      no.onclick = () => decide(t.id, ap.id, false);
      box.append(ok, no);
      li.appendChild(box);
    }
    if (t.status === 'done') {
      const b = document.createElement('button'); b.textContent = 'PDF report'; b.className = 'small';
      b.onclick = () => offerReport(t);
      li.appendChild(b);
      li.addEventListener('mouseenter', () => showDone(t, li));
      li.addEventListener('mouseleave', hideDone);
      li.addEventListener('focusin', () => showDone(t, li));
      li.addEventListener('focusout', hideDone);
      li.tabIndex = 0;
    }
    list.appendChild(li);
    if (t.id === office.hoverId && t.status === 'done') reshow = () => showDone(t, li);
  }
  if (reshow) reshow(); else hideDone();     // the list was redrawn under the mouse: keep the card on the same task, or hide it
}

// Hover a crossed-off task: exactly what was done.
function showDone(t, li) {
  office.hoverId = t.id;
  const pop = document.getElementById('todo-pop');
  const people = ['kevin', t.owner, t.worker].filter(Boolean).map(firstName).join(' → ');
  pop.innerHTML = `<div class="pop-title">${esc(t.text)}</div>
    <div class="pop-meta">${esc(people)} · done ${esc(new Date(t.doneAt).toLocaleString())}</div>
    ${t.summary ? `<p>${esc(t.summary)}</p>` : ''}
    ${t.whatWasDone.length ? `<div class="pop-h">What was done</div><ol>${t.whatWasDone.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${t.drafts.length ? `<div class="pop-h">Drafts in your Gmail</div><ul>${t.drafts.map((d) => `<li>${esc(d.subject)}${d.to.length ? ' → ' + esc(d.to.join(', ')) : ''}</li>`).join('')}</ul>` : ''}
    ${(t.approvals || []).length ? `<div class="pop-h">Calendar</div><ul>${t.approvals.map((a) => `<li>${esc(a.payload.summary || a.what)}: ${esc(a.status === 'done' ? 'saved' : a.status)}</li>`).join('')}</ul>` : ''}
    ${t.noteForHarm ? `<div class="pop-h">For you</div><p>${esc(t.noteForHarm)}</p>` : ''}`;
  const r = li.getBoundingClientRect();
  pop.hidden = false;
  const w = pop.offsetWidth;
  pop.style.top = Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, r.top)) + 'px';
  pop.style.left = (r.left - w - 12 > 8 ? r.left - w - 12 : Math.min(window.innerWidth - w - 8, r.right + 12)) + 'px';
}
function hideDone() { office.hoverId = null; document.getElementById('todo-pop').hidden = true; }

function renderChat() {
  const c = office.chat;
  if (!c) return;
  const p = personById(c.id);
  document.getElementById('chat-face').src = `assets/portraits/${c.id}.jpg`;
  document.getElementById('chat-name').textContent = p.name;
  document.getElementById('chat-role').textContent = c.id === 'kevin' ? 'Chief of Staff' : roleLabel(p);
  const log = document.getElementById('chat-log');
  log.innerHTML = '';
  for (const turn of c.turns) {
    const div = document.createElement('div');
    div.className = 'msg ' + (turn.role === 'user' ? 'me' : 'them');
    div.textContent = turn.content;
    log.appendChild(div);
  }
  if (c.streaming) { const div = document.createElement('div'); div.className = 'msg them'; div.textContent = c.streaming; log.appendChild(div); }
  if (!c.turns.length && !c.streaming) log.innerHTML = `<div class="msg hint">Say hello, or ask ${esc(p.name.split(' ')[0])} to do something. If they say they'll do it, it goes on your to-do list.</div>`;
  log.scrollTop = log.scrollHeight;
  document.getElementById('chat-send').disabled = c.busy;
}

// ---------- wiring ----------

document.getElementById('todo-btn').addEventListener('click', () => {
  const panel = document.getElementById('todo');
  panel.hidden = !panel.hidden;
  document.getElementById('todo-btn').setAttribute('aria-pressed', String(!panel.hidden));
  if (!panel.hidden) document.getElementById('todo-input').focus();
});
document.getElementById('todo-close').addEventListener('click', () => { document.getElementById('todo').hidden = true; document.getElementById('todo-btn').setAttribute('aria-pressed', 'false'); canvas.focus(); });
const todoInput = document.getElementById('todo-input');
todoInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter' && todoInput.value.trim()) { createTask(todoInput.value, 'todo'); todoInput.value = ''; }
});
document.getElementById('todo-add').addEventListener('click', () => { if (todoInput.value.trim()) { createTask(todoInput.value, 'todo'); todoInput.value = ''; todoInput.focus(); } });

const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
document.getElementById('chat-send').addEventListener('click', sendChat);
document.getElementById('chat-close').addEventListener('click', () => { document.getElementById('chat').hidden = true; office.chat = null; canvas.focus(); });

// Click on someone in the village to talk to them (instead of walking there).
canvas.addEventListener('pointerdown', (e) => {
  if (editor.on) return;
  const [wx, wy] = screenToWorld(e.offsetX, e.offsetY);
  const p = personAt(wx, wy);
  if (!p) return;
  e.stopImmediatePropagation();
  state.target = null;
  openChat(p.role === 'Kevin' ? 'kevin' : p.id);
}, true);

// Who's on the phone: Kevin calling a director, a director calling their worker.
function officeCallsNow() {
  office.calls = office.calls.filter((c) => c.until > state.time);
  return office.calls;
}

(async () => {
  [office.db, office.sample, office.mcp, office.downloads] = await Promise.all(['db', 'sample', 'mcp', 'downloads'].map((n) => (window.claude && window.claude.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null))));
  const note = document.getElementById('todo-note');
  if (!office.sample) note.textContent = 'Open the village on claude.ai so the team can work (it uses your Claude plan).';
  else if (!office.mcp) note.textContent = 'Gmail and Calendar are not available in this view.';
  else note.textContent = 'Kevin passes each task to the right director. Runs on your Claude plan while this page is open.';
  if (office.db) {
    try {
      const snap = await office.db.collection('tasks').orderBy('createdAt', 'desc').limit(100).get();
      for (const d of snap.docs) {
        const t = d.data();
        const copy = JSON.parse(JSON.stringify(t));
        if (!['done', 'needs_harm', 'paused'].includes(copy.status)) { copy.status = 'paused'; copy.pauseReason = 'The page was closed while this was being worked on. Click Continue.'; }
        office.tasks.set(copy.id, copy);
      }
    } catch (e) { /* empty list */ }
  }
  office.ready = true;
  renderTodo();
})();
renderTodo();
