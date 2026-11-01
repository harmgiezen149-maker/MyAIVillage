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
    assert.ok(res.arrived >= res.trips - 1, `arrived ${res.arrived}/${res.trips}: ${res.fails.join('; ')}`);
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => state.scene), 'post-house', 'walking into the door goes inside');
    await page.evaluate(() => { const [ex, ey] = ROOMS[state.scene].exit; state.doorArmed = true; state.target = [ex, ey]; for (let i = 0; i < 60 * 20 && state.fade <= 0; i++) update(1 / 60); });
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => state.scene), 'map', 'the exit goes back out');
    assert.deepEqual(v.errors, []);
  } finally { await v.close(); }
});
