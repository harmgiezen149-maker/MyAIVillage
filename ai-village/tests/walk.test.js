// Walking: click-to-walk follows a planned route and arrives; a door takes Harm inside and the exit back out.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openVillage } = require('./lib');

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.server.close());

test('routes arrive, doors work', async () => {
  const v = await openVillage(srv.url, { fake: { noClaude: true } });
  const { page } = v;
  try {
    const res = await page.evaluate(() => {
      const out = { trips: 0, arrived: 0, fails: [] };
      for (let k = 0; k < 25; k++) {
        const goal = randomOpenSpot('map');
        // a click right next to a door means "go inside" (the route then ends in the door), so skip those spots
        if (BUILDINGS.some((b) => b.door && Math.hypot(b.door[0] - goal[0], b.door[1] - goal[1]) < 70)) { k--; continue; }
        state.target = goal; out.trips++;
        let t = 0;
        while (state.target && t < 60 && state.scene === 'map') { update(1 / 60); t += 1 / 60; }
        if (state.scene !== 'map') { state.scene = 'map'; state.building = null; continue; }
        const d = Math.hypot(state.player.x - goal[0], state.player.y - goal[1]);
        if (d < 12) out.arrived++; else out.fails.push(`${goal.map(Math.round)} left ${Math.round(d)}`);
      }
      const ph = BUILDINGS.find((x) => x.id === 'post-house');
      state.target = [ph.door[0] + 20, ph.door[1] + 10];
      for (let i = 0; i < 60 * 40 && state.scene === 'map'; i++) update(1 / 60);
      return out;
    });
    assert.ok(res.arrived >= res.trips - 2, `arrived ${res.arrived}/${res.trips}: ${res.fails.join('; ')}`);
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => state.scene), 'post-house', 'walking into the door goes inside');
    await page.evaluate(() => { const [ex, ey] = ROOMS[state.scene].exit; state.doorArmed = true; state.target = [ex, ey]; for (let i = 0; i < 60 * 20 && state.fade <= 0; i++) update(1 / 60); });
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => state.scene), 'map', 'the exit goes back out');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});

test('walk to someone: a figure in the village (talk on arrival), someone indoors, the faces on the phone, the list', async () => {
  const v = await openVillage(srv.url);
  const { page } = v;
  try {
    // someone outside in the village: walk over, the conversation opens on arrival
    const outside = await page.evaluate(() => { const r = residents.find((x) => x.where === 'map' && !x.inMeeting); if (!r) return null; walkTo(r.id, { talk: true }); return r.id; });
    if (outside) {
      await page.waitForFunction((id) => office.chat && office.chat.id === id && !document.getElementById('chat').hidden, outside, { timeout: 60000 });
      const d = await page.evaluate((id) => { const r = residentById(id); return Math.hypot(r.x - state.player.x, r.y - state.player.y) / personHeight(); }, outside);
      assert.ok(d < 2.7, `standing next to them (${d.toFixed(2)} person heights)`);
      await page.evaluate(() => closeChat());
    }
    // someone indoors: Harm walks to the house and goes in
    const inside = await page.evaluate(() => {
      const r = residents.find((x) => x.where !== 'map' && x.where !== state.scene && !x.inMeeting && !x.plan);
      if (!r) return null;
      walkTo(r.id); return { id: r.id, where: r.where };
    });
    assert.ok(inside, 'someone is indoors');
    await page.waitForFunction((x) => state.scene === residentById(x.id).where && !visit.id, inside, { timeout: 90000 });
    assert.equal(await page.evaluate(() => state.scene), await page.evaluate((id) => residentById(id).where, inside.id));
    // a face "aan de telefoon"
    await page.evaluate(() => startCall('kevin', 'rosie-bell', 'Hoi Rosie'));
    await page.waitForSelector('#call .caller[data-id="rosie-bell"]');
    await page.click('#call .caller[data-id="rosie-bell"]');
    assert.equal(await page.evaluate(() => visit.id), 'rosie-bell');
    // the list "Wie is waar"
    await page.click('#people-btn');
    assert.equal(await page.locator('#people-list .people-row').count(), await page.evaluate(() => residents.length + 1));
    await page.click('#people-list .people-row[data-id="jasper-vale"]');
    assert.equal(await page.evaluate(() => visit.id), 'jasper-vale');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => visit.id), null, 'walking with the keys stops it');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});
