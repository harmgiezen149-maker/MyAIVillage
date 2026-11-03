// The village loads without errors on a computer and a phone, and every box opens and closes.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openVillage } = require('./lib');

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.server.close());

test('computer: loads, panels open and close, Dutch labels', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'nl');
    await page.click('#todo-btn');
    assert.equal(await page.isVisible('#todo'), true, 'to-do list opens');
    await page.click('#profile-btn');
    assert.equal(await page.isVisible('#profile'), true, 'Over mij opens');
    assert.equal(await page.isVisible('#todo'), false, 'the to-do list makes room for Over mij');
    await page.focus('#profile-save');
    await page.keyboard.press('Escape');
    assert.equal(await page.isVisible('#profile'), false, 'Escape on a button closes the box');
    await page.click('#kevin-btn');
    assert.equal(await page.isVisible('#chat'), true, 'Kevin chat opens');
    assert.match(await page.textContent('#chat-role'), /Stafchef/);
    await page.click('#edit');
    assert.match(await page.getAttribute('#tools button', 'title'), /toets 1/, 'tool hint is Dutch');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('phone: Meer menu, compact editor at the bottom, one sheet at a time', async () => {
  const v = await openVillage(srv.url, { phone: true });
  const { page } = v;
  try {
    assert.equal(await page.isVisible('#edit'), false, 'extra buttons hidden behind Meer');
    await page.tap('#more-btn');
    await page.tap('#edit');
    const box = await page.evaluate(() => document.getElementById('editor').getBoundingClientRect().toJSON());
    assert.ok(box.bottom <= 844 && box.top > 844 * 0.45, `editor sits low on the screen (top ${Math.round(box.top)})`);
    await page.tap('#done');
    await page.tap('#todo-btn');
    await page.tap('#kevin-btn');
    assert.equal(await page.isVisible('#todo'), false, 'opening the chat closes the to-do sheet');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('direct links: #rosie opens the talk with Rosie, #taken the to-do list; the address follows the conversation', async () => {
  const v = await openVillage(srv.url + '#rosie');
  const { page } = v;
  try {
    await page.waitForFunction(() => !document.getElementById('chat').hidden && office.chat && office.chat.id === 'rosie-bell');
    assert.match(await page.textContent('#chat-name'), /Rosie/);
    assert.equal(await page.evaluate(() => location.hash), '#rosie');
    await page.evaluate(() => closeChat());
    assert.equal(await page.evaluate(() => location.hash), '');
    await page.evaluate(() => { location.hash = 'kevin'; });
    await page.waitForFunction(() => office.chat && office.chat.id === 'kevin' && !document.getElementById('chat').hidden);
    await page.evaluate(() => { location.hash = 'taken'; });
    await page.waitForFunction(() => !document.getElementById('todo').hidden);
    await page.click('#profile-btn');
    assert.equal(await page.locator('#profile-links [data-link]').count(), 11, 'Kevin, nine directors and the to-do list');
    assert.equal(await page.getAttribute('#profile-links [data-link]', 'data-link'), 'https://claude.ai/artifact/6w8CwvAmosjzt8C26LowVc#kevin');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('the card beside a done task can be scrolled, and opens the full report', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    await page.evaluate(() => {
      const long = Array.from({ length: 40 }, (_, i) => `Stap ${i + 1}: iets gedaan`);
      office.tasks.set('tlong', { id: 'tlong', text: 'Lange taak', from: 'todo', words: 'x', createdAt: new Date().toISOString(), doneAt: new Date().toISOString(),
        status: 'done', owner: 'imani-okafor', summary: 'Samenvatting.', whatWasDone: long, drafts: [], approvals: [], results: [], log: [] });
      renderTodo();
    });
    await page.click('#todo-btn');
    await page.hover('#todo-list .todo-item.done .todo-text');
    await page.waitForSelector('#todo-pop:not([hidden])');
    await page.hover('#todo-pop .pop-title');                      // move onto the card: it stays open
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
    assert.equal(await page.isVisible('#todo-pop'), true, 'still open after moving onto it');
    assert.ok(await page.evaluate(() => document.getElementById('todo-pop').scrollTop) > 100, 'the card scrolled');
    await page.click('#todo-pop .pop-full');
    assert.equal(await page.isVisible('#report-view'), true, 'full report from the card');
    await page.click('#rv-close');
    await page.click('#todo-list .todo-item.done .todo-text');      // a tap opens it again (touch screens)
    assert.equal(await page.isVisible('#todo-pop'), true);
    await page.click('#todo-pop .pop-close');
    assert.equal(await page.isVisible('#todo-pop'), false);
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('phone: opening a box does not pop up the keyboard; tapping the text box does', async () => {
  const v = await openVillage(srv.url, { phone: true });
  const { page } = v;
  const typing = () => page.evaluate(() => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== 'range'; });
  try {
    await page.tap('#todo-btn');
    assert.equal(await typing(), false, 'to-do list: no keyboard');
    await page.tap('#kevin-btn');
    assert.equal(await typing(), false, 'chat: no keyboard');
    await page.tap('#chat-input');
    assert.equal(await typing(), true, 'tapping the box brings the keyboard');
    await page.evaluate(() => closeChat());
    await page.tap('#more-btn'); await page.tap('#profile-btn');
    assert.equal(await typing(), false, 'Over mij: no keyboard');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('computer: opening the to-do list still puts the cursor in the box', async () => {
  const v = await openVillage(srv.url);
  try {
    await v.page.click('#todo-btn');
    assert.equal(await v.page.evaluate(() => document.activeElement.id), 'todo-input');
  } finally { await v.close(); }
});
