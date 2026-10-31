const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:8765/index.html');
  await p.waitForFunction(() => !document.getElementById('enter').disabled);
  const res = await p.evaluate(() => {
    const out = {};
    const bfs = (start, step, W, H) => { const seen = new Set(); const q=[start]; seen.add(start.join()); 
      while (q.length) { const [x,y]=q.shift(); for (const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]) { const nx=x+dx, ny=y+dy; const k=nx+','+ny; if (nx<0||ny<0||nx>W||ny>H||seen.has(k)) continue; if (!canStand(nx,ny)) continue; seen.add(k); q.push([nx,ny]); } } return seen; };
    state.scene='map'; const s=8; const seen=bfs([Math.round(START[0]/s)*s, Math.round(START[1]/s)*s], s, MAP.w, MAP.h);
    for (const bd of BUILDINGS) { let ok=false; for (const k of seen) { const [x,y]=k.split(',').map(Number); if (Math.hypot(x-bd.door[0],y-bd.door[1])<22) {ok=true;break;} } out[bd.name]=ok; }
    for (const id of Object.keys(ROOMS)) { state.scene=id; const r=ROOMS[id]; const p0=r.start||[r.exit[0],r.exit[1]-70]; const st=[Math.round(p0[0]/s)*s, Math.round(p0[1]/s)*s]; const ok0=canStand(...st); const sn=bfs(st,s,1200,896); 
      out['room '+id]= ok0 ? `start ok, ${sn.size} cells, exitReach=${[...sn].some(k=>{const [x,y]=k.split(',').map(Number);return Math.abs(x-r.exit[0])<55&&y>r.exit[1];})}` : 'START BLOCKED'; }
    state.scene='map'; return out; });
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
