// The smarter team: a question to every director, Kevin's bundle with a top 3, the briefing, memory and
// profile, resume all, and the archive.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openVillage } = require('./lib');

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.server.close());

test('every director answers, at most 3 work at once, Kevin bundles with a top 3', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    await page.click('#todo-btn');
    await page.fill('#todo-input', 'Laat iedere directeur 3 punten noemen');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...office.tasks.values()].some((t) => t.subtasks && t.status === 'done'), null, { timeout: 30000 });
    const p = await page.evaluate(() => { const t = [...office.tasks.values()].find((x) => x.subtasks); return { parts: t.subtasks.length, top3: t.top3 }; });
    assert.equal(p.parts, await page.evaluate(() => DIRECTORS.length));
    assert.deepEqual(p.top3, ['Eerste', 'Tweede', 'Derde']);
    assert.ok(await page.evaluate(() => window.__fake.maxActive) <= 3, 'no more than 3 directors at once');
    assert.ok(await page.evaluate(() => /say it ONCE/.test(window.__fake.prompts.find((x) => x.includes('Bundle this for Harm')))), 'duplicates are merged (D3)');
    await page.waitForFunction(() => office.chat && /Top 3 voor jou:\n1\. Eerste/.test(office.chat.turns.slice(-1)[0].content));
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('profile and memory go into the prompts; thumbs down with a comment is remembered', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    await page.click('#profile-btn');
    await page.fill('#profile-text', 'Ik hou van korte antwoorden.');
    await page.click('#profile-save');
    await page.waitForFunction(() => window.__fake.store['settings/profile']);
    await page.click('#profile-close');
    await page.click('#todo-btn');
    await page.fill('#todo-input', 'Zoek kiprecepten'); await page.keyboard.press('Enter');
    await page.waitForSelector('#chat .feedback button', { timeout: 15000 });
    await page.click('#chat .feedback button:nth-child(2)');
    await page.fill('#chat .feedback input', 'Ook vegetarisch graag');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window.__fake.store['memory/rosie-bell'] || { items: [] }).items.some((x) => x.feedback === 'bad'));
    await page.evaluate(() => closeChat());
    await page.fill('#todo-input', 'Nog meer recepten'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...office.tasks.values()].filter((t) => t.status === 'done').length === 2, null, { timeout: 15000 });
    const prompt = await page.evaluate(() => window.__fake.prompts.filter((x) => x.includes('director of the')).pop());
    assert.match(prompt, /korte antwoorden/);
    assert.match(prompt, /WHAT YOU REMEMBER/);
    assert.match(prompt, /NOT good — Ook vegetarisch graag/);
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('briefing: four parts, one pauses, Alles hervatten finishes it; archive, search and delete', async () => {
  const v = await openVillage(srv.url, { fake: { failOnce: 'Kookboek app' } });
  const { page } = v;
  try {
    await page.click('#todo-btn');
    await page.click('#briefing-btn');
    await page.waitForFunction(() => [...office.tasks.values()].some((t) => t.briefing && t.subtasks && t.subtasks.length === 4
      && t.subtasks.every((id) => ['done', 'paused'].includes(office.tasks.get(id).status))), null, { timeout: 20000 });
    assert.equal(await page.isVisible('#resume-all'), true);
    await page.click('#resume-all');
    await page.waitForFunction(() => [...office.tasks.values()].some((t) => t.briefing && t.status === 'done'), null, { timeout: 20000 });
    assert.equal(await page.isVisible('#resume-all'), false);
    // archive: a task done 9 days ago
    await page.evaluate(() => { const t = [...office.tasks.values()].find((x) => x.briefing); t.doneAt = new Date(Date.now() - 9 * 86400000).toISOString(); renderTodo(); });
    assert.match(await page.textContent('.todo-archive summary'), /Archief \(1\)/);
    await page.fill('#todo-search', 'geen-match-xyz');
    assert.match(await page.textContent('#todo-list'), /Niets gevonden/);
    await page.fill('#todo-search', 'briefing');
    assert.equal((await page.$$('#todo-list .todo-item.done')).length, 1);
    const del = await page.$('#todo-list .todo-del');
    await del.click(); await del.click();
    await page.waitForFunction(() => office.tasks.size === 0);
    assert.equal(await page.evaluate(() => Object.keys(window.__fake.store).filter((k) => k.startsWith('tasks/')).length), 0, 'deleted from the database too');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('memory loaded from the (read-only) database still grows; a task stuck while finishing is finished, not redone', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    // a dossier that came from the database, like after reloading the page (Harm's bug, 2026-11-01)
    await page.evaluate(async () => {
      await office.db.doc('memory/leo-castellano').set({ id: 'leo-castellano', items: [{ at: '2026-11-01', taskId: 'old', task: 'oud', summary: 'oud' }] });
      const snap = await office.db.collection('memory').get();
      for (const d of snap.docs) memory.dossiers[d.data().id] = { items: d.data().items };   // the old, read-only way
    });
    const before = await page.evaluate(() => window.__fake.prompts.length);
    // a task whose work was done but that paused while finishing
    await page.evaluate(() => {
      const t = { id: 'tstuck', text: '3 punten vanuit het Herautenhuis', from: 'todo', words: 'x', createdAt: new Date().toISOString(), status: 'paused', owner: 'leo-castellano',
        pauseReason: 'Cannot add property 1, object is not extensible', doneAt: new Date().toISOString(), summary: 'Drie punten.', outcome: 'done',
        log: [], drafts: [], approvals: [], results: [], whatWasDone: [] };
      office.tasks.set(t.id, t); renderTodo();
    });
    await page.click('#todo-btn');
    await page.click('.todo-item.paused button');
    await page.waitForFunction(() => office.tasks.get('tstuck').status === 'done');
    assert.equal(await page.evaluate(() => window.__fake.prompts.length), before, 'no new Claude call: the work is not redone');
    assert.ok(await page.evaluate(() => (window.__fake.store['memory/leo-castellano'] || { items: [] }).items.length) >= 1);
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('recurring tasks: plan per director with time and days, pause, delete; an answer from the cloud shows up in that director\'s chat', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    await page.click('#todo-btn');
    await page.click('#plans-btn');
    await page.selectOption('#plan-owner', 'margot-finch');
    await page.fill('#plan-text', 'Bekijk mijn agenda en mail en geef een update met advies.');
    await page.fill('#plan-time', '07:30');
    await page.click('#plan-days [data-preset="all"]');
    await page.click('#plan-save');
    await page.waitForFunction(() => Object.keys(window.__fake.store).some((k) => k.startsWith('schedules/')));
    const plan = await page.evaluate(() => Object.entries(window.__fake.store).find(([k]) => k.startsWith('schedules/'))[1]);
    assert.equal(plan.owner, 'margot-finch'); assert.equal(plan.time, '07:30'); assert.deepEqual(plan.days, [1, 2, 3, 4, 5, 6, 7]); assert.equal(plan.active, true);
    assert.match(await page.textContent('#plan-list'), /Margot · 07:30 · elke dag/);
    await page.click('#plan-list [data-act="toggle"]');
    await page.waitForFunction(() => Object.values(window.__fake.store).some((x) => x.time === '07:30' && x.active === false));
    assert.match(await page.textContent('#plan-list'), /gepauzeerd/);
    // the cloud wrote an answer with a draft and a calendar proposal
    await page.evaluate((id) => {
      const now = new Date().toISOString();
      window.__fake.store['tasks/tsched-' + id + '-20261104'] = { id: 'tsched-' + id + '-20261104', text: 'Bekijk mijn agenda en mail', words: 'x', from: 'schedule', scheduleId: id, createdAt: now, updatedAt: now, doneAt: now,
        status: 'needs_harm', outcome: 'done', owner: 'margot-finch', worker: null, askedPerson: null, parentId: null, announced: false, calls: 0,
        summary: 'Drie afspraken vandaag; twee mails vragen om antwoord.', results: [], whatWasDone: ['Agenda bekeken'], noteForHarm: 'Keur de afspraak goed.',
        drafts: [{ at: now, by: 'margot-finch', to: ['anna@example.org'], subject: 'Re: etentje', body: 'Hoi Anna', url: '', id: 'd1' }],
        approvals: [{ id: 'a1', kind: 'create_event', by: 'margot-finch', status: 'pending', at: now, payload: { summary: 'Bellen met Anna', startTime: '2026-11-05T10:00:00', endTime: '2026-11-05T10:15:00' } }],
        sources: [], suspicious: '', log: [{ at: now, who: 'margot-finch', text: 'Agenda bekeken.' }] };
    }, plan.id);
    await page.evaluate(() => pickUpNew());
    await page.waitForFunction(() => office.chat && office.chat.id === 'margot-finch' && office.chat.turns.some((t) => t.role === 'result'), null, { timeout: 10000 });
    assert.equal(await page.evaluate((id) => window.__fake.store['tasks/tsched-' + id + '-20261104'].announced, plan.id), true, 'told once, not again on the next visit');
    await page.evaluate(() => closeChat());
    await page.click('#todo-btn');
    await page.click('.todo-approval button.primary');                  // Harm approves the calendar proposal in the village
    await page.waitForFunction(() => [...office.tasks.values()].some((t) => t.from === 'schedule' && t.status === 'done'));
    assert.ok(await page.evaluate(() => window.__fake.mcp.includes('Google Calendar:create_event')));
    // delete the plan (click twice)
    await page.evaluate(() => closeChat());
    await page.click('#plans-btn');
    const del = page.locator('#plan-list [data-act="del"]');
    await del.click(); await del.click();
    await page.waitForFunction(() => !Object.keys(window.__fake.store).some((k) => k.startsWith('schedules/')));
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});
