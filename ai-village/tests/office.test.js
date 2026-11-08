// Tasks: Kevin routes, the director works, approvals, resume without double work, and the answer in the chat.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openVillage } = require('./lib');

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.server.close());

const tasks = (page) => page.evaluate(() => [...office.tasks.values()].map((t) => ({ text: t.text, status: t.status, owner: t.owner, summary: t.summary, drafts: t.drafts.length, approvals: t.approvals.map((a) => a.status) })));

test('a task with a draft and a calendar proposal, repaired answer, resume, approve twice', async () => {
  const v = await openVillage(srv.url, { fake: { draftAndEvent: true, badJsonOnce: true, calFailOnce: true } });
  const { page } = v;
  try {
    await page.click('#todo-btn');
    await page.fill('#todo-input', 'Regel een etentje');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...office.tasks.values()].some((t) => t.status === 'needs_harm'), null, { timeout: 15000 });
    let [t] = await tasks(page);
    assert.equal(t.summary, 'Gered uit de ruwe tekst.', 'an unreadable answer is repaired, not redone (B4)');
    // B2: resume -> the director is told what is already done; the draft and proposal are not made twice
    await page.evaluate(() => { const x = [...office.tasks.values()][0]; x.status = 'assigned'; return runTask(x); });
    assert.ok(await page.evaluate(() => /STARTED BEFORE/.test(window.__fake.prompts.filter((p) => p.includes('director of the')).pop())));
    [t] = await tasks(page);
    assert.equal(t.drafts, 1); assert.equal(t.approvals.length, 1);
    assert.equal(await page.evaluate(() => window.__fake.mcp.filter((x) => x.endsWith(':create_draft')).length), 1);
    // B3: unclear failure -> "Controleren en goedkeuren" -> checks first, adds nothing twice
    await page.click('.todo-approval button.primary');
    await page.waitForFunction(() => [...office.tasks.values()][0].approvals[0].status === 'unsure');
    assert.equal(await page.textContent('.todo-approval button.primary'), 'Controleren en goedkeuren');
    await page.click('.todo-approval button.primary');
    await page.waitForFunction(() => [...office.tasks.values()][0].status === 'done', null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__fake.mcp.filter((x) => x.endsWith(':create_event')).length), 1);
    // the answer comes back in Kevin's chat, with the PDF link and thumbs
    await page.waitForSelector('#chat .msg.result .feedback button');
    assert.match(await page.textContent('#chat .msg.result'), /Volledig rapport/);
    assert.match(await page.textContent('#todo-usage'), /Vandaag \d+ aanroep/);
    // the full report opens on screen first (Harm, 2026-11-02); the PDF is a button inside it
    await page.click('#chat .msg.result .result-link');
    await page.waitForSelector('#report-view:not([hidden])');
    const rv = await page.textContent('#rv-body');
    assert.match(rv, /In het kort/); assert.match(rv, /Concepten in je Gmail/); assert.match(rv, /Agenda- en app-wijzigingen/);
    assert.equal(await page.textContent('#rv-title'), 'Regel een etentje');
    assert.match(await page.textContent('#rv-pdf'), /Opslaan als PDF/);
    await page.keyboard.press('Escape');
    assert.equal(await page.isVisible('#report-view'), false, 'Escape closes the report');
    await page.click('#todo-list .todo-item.done button');      // "Rapport bekijken" in the to-do list
    assert.equal(await page.isVisible('#report-view'), true);
    await page.click('#rv-close');
    assert.equal(await page.isVisible('#report-view'), false);
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('nobody gets more than 16 tools; models are Harm\'s choice', async () => {
  const v = await openVillage(srv.url);
  try {
    const counts = await v.page.evaluate(() => residents.filter((r) => r.role === 'Director' || r.role === 'Worker')
      .map((r) => [r.id, teamTools({ approvals: [], drafts: [], log: [] }, r.id).length + (r.role === 'Director' ? 2 : 0)]));
    for (const [id, n] of counts) assert.ok(n <= 16, `${id} has ${n} tools`);
    assert.deepEqual(await v.page.evaluate(() => MODELS), { kevin: 'claude-opus-5-5', director: 'claude-opus-5-5', worker: 'claude-sonnet-5-5', advisor: 'claude-fable-5-1' });
  } finally { await v.close(); }
});

test('talking: a promise becomes a task, "kom hier" summons, internet pages only from own results', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    await page.click('#kevin-btn');
    await page.fill('#chat-input', 'Kun je mijn inbox sorteren?');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...office.tasks.values()].some((t) => t.text === 'Sorteer mijn inbox' && t.status === 'done'), null, { timeout: 15000 });
    await page.fill('#chat-input', 'Margot, kom hier');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => residents.find((r) => r.id === 'margot-finch').summoned), true);
    const allowed = await page.evaluate(() => {
      const t = { text: 'kijk naar https://harm.example/x', words: '', netLinks: [] };
      rememberLinks(t, { items: [{ link: 'https://news.example/story?id=1' }] });
      return [linkAllowed(t, 'https://news.example/story?id=1'), linkAllowed(t, 'https://harm.example/x'), linkAllowed(t, 'https://evil.example/?data=secret')];
    });
    assert.deepEqual(allowed, [true, true, false]);
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('a connector not yet allowed for the page: a bar with a button; the button asks from Harm\'s click', async () => {
  const v = await openVillage(srv.url, { fake: { useNet: true, netUnconfirmed: true } });
  const { page } = v;
  try {
    await page.click('#todo-btn');
    await page.fill('#todo-input', 'Wat is het laatste nieuws over Claude?'); await page.keyboard.press('Enter');
    await page.waitForSelector('#consent-bar:not([hidden]) [data-allow="Internet"]', { timeout: 15000 });
    assert.match(await page.evaluate(() => window.__fake.netError), /toestaan/, 'the director is told what Harm must do');
    await page.evaluate(() => { window.__fake.netAllowed = true; });     // Harm says yes in claude.ai's question
    await page.click('[data-allow="Internet"]');
    await page.waitForSelector('#consent-bar', { state: 'hidden' });
    // Over mij: test all connectors
    await page.click('#profile-btn');
    await page.click('#connectors-test');
    await page.waitForFunction(() => [...document.querySelectorAll('#connectors-list li span')].every((x) => !/bezig/.test(x.textContent)));
    assert.ok(await page.locator('#connectors-list li').count() >= 5);
    assert.match(await page.textContent('#connectors-list'), /Internet ✓ werkt/);
    assert.equal(await page.evaluate(() => localStorage.getItem('village-net-name')), 'Internet', 'the working name is remembered');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('Rosie the village therapist: session in her Praktijk, the skill in the prompt, saving in the Drive list, nothing kept elsewhere', async () => {
  const voices = [{ name: 'Google Nederlands', lang: 'nl-NL', localService: false }, { name: 'Xander', lang: 'nl-NL', localService: true },
    { name: 'Claire', lang: 'nl-NL', localService: true }, { name: 'Samantha', lang: 'en-US', localService: true }];
  const v = await openVillage(srv.url, { fake: { voices } });
  const { page } = v;
  try {
    assert.match(await page.evaluate(() => BUILDINGS.find((b) => b.id === 'family-cottage').name), /Praktijk van Rosie/);
    // "laten we mijn dag doornemen" in Rosie's chat starts the session; that line is not kept in her chat
    await page.evaluate(() => openChat('rosie-bell'));
    await page.waitForSelector('#chat-session-row:not([hidden]) #chat-session');
    await page.fill('#chat-input', 'Laten we mijn dag doornemen');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#session:not([hidden])');
    await page.waitForFunction(() => therapy.harmSeated && residentById('rosie-bell').sessionSeat, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => state.scene), 'family-cottage');
    // the painted session picture (one of the variants) fades in once both sit
    await page.waitForFunction(() => { const s = sessionSceneNow(); return s && s.alpha >= 1; }, null, { timeout: 15000 });
    assert.ok(await page.evaluate(() => SESSION_SCENES.includes(therapy.scene)));
    assert.deepEqual(await page.evaluate(() => residents.filter((r) => r.where === 'family-cottage' && r.id !== 'rosie-bell').map((r) => r.id)), [], 'nobody else in the room');
    // a turn: the skill's rules go to Claude with Opus
    await page.fill('#session-input', 'Ik heb vandaag in de zon naar huis gefietst.');
    await page.click('#session-send');
    await page.waitForFunction(() => therapy.turns.some((t) => t.content === 'Wat maakte dat fijn voor jou?'));
    const prompt = await page.evaluate(() => window.__fake.sessionPrompt);
    assert.match(prompt, /positieve ervaringen/); assert.match(prompt, /Eén vraag per bericht/); assert.match(prompt, /113/);
    assert.ok(await page.evaluate(() => window.__fake.calls.some((c) => c.model === 'claude-opus-5-5' && c.tools.includes('propose_save'))));
    // Rosie speaks: her greeting and her question, calm, with the on-device Dutch female voice (never the online one)
    const said = await page.evaluate(() => window.__fake.spoken.filter((x) => x.text));
    assert.ok(said.some((x) => /Fijn dat je er bent/.test(x.text)), 'the greeting is spoken');
    assert.ok(said.some((x) => x.text === 'Wat maakte dat fijn voor jou?'), 'her question is spoken');
    assert.ok(said.every((x) => x.voice === 'Claire' && x.rate < 1), 'Claire, slowly');
    assert.match(await page.textContent('#session-voice'), /Stem aan/);
    assert.match(await page.textContent('#session-voice-info'), /Stem: Claire \(nl-NL\), op dit apparaat/);
    await page.click('#session-voice');                                          // Harm turns her voice off
    assert.match(await page.textContent('#session-voice'), /Stem uit/);
    assert.equal(await page.evaluate(() => localStorage.getItem('rosie-stem')), 'uit');
    assert.equal(await page.textContent('#session-voice-info'), 'Stem: uit');
    const before = said.length;
    // Rosie proposes the rows; nothing is saved before Harm presses the button
    await page.fill('#session-input', 'Ja, laten we opslaan.');
    await page.click('#session-send');
    await page.waitForSelector('#session-save');
    assert.equal(await page.evaluate(() => window.__fake.spoken.filter((x) => x.text).length), before, 'silent when switched off');
    await page.click('#session-voice');                                          // and on again
    assert.equal(await page.evaluate(() => window.__fake.drive.created.length), 0);
    await page.click('#session-save');
    await page.waitForFunction(() => therapy.turns.some((t) => /Ze staan erin: 1 ervaring erbij, nu 3 in totaal/.test(t.content)), null, { timeout: 15000 });
    const d = await page.evaluate(() => ({ created: window.__fake.drive.created, trashed: window.__fake.drive.trashed, csv: window.__fake.drive.files[window.__fake.drive.created[0]].csv }));
    assert.deepEqual(d.trashed, ['L1'], 'the old version goes to the trash only after the check');
    assert.match(d.csv, /^Datum,Ervaring,Waarom het fijn was,Gevoel,Sterkte \(0-100\),Reflexie\n/);
    assert.match(d.csv, /Repetitie met de band,Muziek maken,Plezier,80,Ik hoor erbij/, 'old rows kept, with the > unescaped');
    assert.match(d.csv, /08-11-2026,Fietstocht naar huis in de zon,Even tijd voor mezelf,Rustig,70,Ik neem de tijd voor mijzelf > ik weet wat mij helpt\n$/);
    // empty reflections: read, propose, save (row count stays the same)
    await page.fill('#session-input', 'Kunnen we de lege reflecties doen?');
    await page.click('#session-send');
    await page.waitForFunction(() => window.__fake.emptyRows);
    assert.equal(await page.evaluate(() => window.__fake.emptyRows.zonder_reflectie), 1);
    await page.fill('#session-input', 'Vul in: ik ben een teamplayer');
    await page.click('#session-send');
    await page.waitForSelector('#session-save');
    await page.click('#session-save');
    await page.waitForFunction(() => therapy.turns.some((t) => /1 reflectie aangevuld; er zijn er nog 0 leeg/.test(t.content)), null, { timeout: 15000 });
    // privacy: nothing of the session in the village's own storage; forgotten when the session ends
    const stored = await page.evaluate(() => JSON.stringify(window.__fake.store));
    assert.ok(!/zon naar huis|Fietstocht|teamplayer|dag doornemen/i.test(stored), 'no session text in the village database');
    await page.click('#session-end');
    assert.equal(await page.isVisible('#session'), false);
    assert.equal(await page.evaluate(() => therapy.turns.length), 0);
    assert.equal(await page.evaluate(() => therapy.harmSeated), false);
    // the evening bar and the direct link
    await page.evaluate(() => { document.getElementById('rosie-bar').hidden = false; });
    await page.click('#rosie-yes');
    await page.waitForSelector('#session:not([hidden])');
    assert.equal(await page.evaluate(() => location.hash), '#rosie-sessie');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});
