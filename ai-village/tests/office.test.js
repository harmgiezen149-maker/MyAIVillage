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
