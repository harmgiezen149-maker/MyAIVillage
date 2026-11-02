var crypto = require('crypto');
var mcp = require('./_lib/mcp');
var web = require('./_lib/web');

// De deur voor Claude: een MCP-server op /api/mcp/<sleutel> (vercel.json zet dat om naar /api/mcp?sleutel=…).
// De sleutel staat als MCP_SLEUTEL in de omgeving van dit Vercel-project; klopt hij niet, dan volgt een kale 404.
// Alleen lezen van openbaar internet. Geen API-sleutels, geen kosten.

var INFO = {
  name: 'internet', version: '1.1.0',
  instructions: "Public internet for Harm's AI village: broad search (Google News, Bing News, Wikipedia, Marginalia together), scientific research (OpenAlex), Google News (nl/en), Wikipedia, Hacker News, arXiv, and reading a web page by its address. Read-only. Search, then read the best pages from the links you find. Always name your sources."
};

function sleutelKlopt(gekregen) {
  var echt = process.env.MCP_SLEUTEL || '';
  if (echt.length < 30) return false;
  var a = crypto.createHash('sha256').update(String(gekregen || '')).digest();
  var b = crypto.createHash('sha256').update(echt).digest();
  return crypto.timingSafeEqual(a, b);
}

function stuur(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(data);
}

// De sleutel: uit de omgezette query (?sleutel=), of rechtstreeks uit het adres (/api/mcp/<sleutel>).
function sleutelUit(req) {
  var q = req.query || {};
  if (q.sleutel) return String(q.sleutel);
  var m = /\/api\/mcp\/([A-Za-z0-9_-]+)/.exec(req.url || '') || /[?&]sleutel=([A-Za-z0-9_-]+)/.exec(req.url || '');
  return m ? m[1] : '';
}

// De inhoud van het verzoek: wat Vercel al heeft gelezen, of zelf uit de stroom lezen.
async function leesBody(req) {
  var b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  var raw = typeof b === 'string' ? b : Buffer.isBuffer(b) ? b.toString('utf8') : null;
  if (raw == null) {
    raw = await new Promise(function(ok, fout) {
      var delen = [];
      req.on('data', function(c) { delen.push(Buffer.from(c)); });
      req.on('end', function() { ok(Buffer.concat(delen).toString('utf8')); });
      req.on('error', fout);
    });
  }
  return raw ? JSON.parse(raw) : null;
}

// Een eenvoudige limiet: hooguit 300 verzoeken per uur per draaiende instantie (Vercel start er soms meer,
// dus het is een rem, geen exacte teller). Lekt het adres ooit uit, dan kan niemand er onbeperkt op schieten.
var LIMIET_PER_UUR = 300;
var teller = { uur: -1, aantal: 0 };
function binnenLimiet() {
  var uur = Math.floor(Date.now() / 3600000);
  if (teller.uur !== uur) { teller.uur = uur; teller.aantal = 0; }
  teller.aantal++;
  return teller.aantal <= LIMIET_PER_UUR;
}

module.exports = async function handler(req, res) {
  if (!binnenLimiet()) { res.setHeader('Retry-After', '600'); return stuur(res, 429, { error: 'Te veel verzoeken; probeer het later opnieuw.' }); }
  var ok = sleutelKlopt(sleutelUit(req));
  if (!ok) { console.log(JSON.stringify({ mcp: req.method, sleutel: 'fout' })); return stuur(res, 404, {}); }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return stuur(res, 405, { error: 'Alleen POST' }); }
  var body;
  try { body = await leesBody(req); } catch (e) { return stuur(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Geen geldige JSON' } }); }
  // Eén regel per verzoek in het logboek (zonder de sleutel), zodat een probleem te zien is.
  console.log(JSON.stringify({ mcp: 'POST', rpc: Array.isArray(body) ? body.map(function(m) { return m && m.method; }) : body && body.method, tool: body && body.params && body.params.name }));
  var uit = await mcp.verwerk(body, web.maak(), INFO);
  if (uit === null) { res.statusCode = 202; return res.end(); }
  return stuur(res, 200, uit);
};
