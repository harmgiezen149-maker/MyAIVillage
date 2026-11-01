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
