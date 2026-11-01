var crypto = require('crypto');
var mcp = require('./_lib/mcp');
var web = require('./_lib/web');

// De deur voor Claude: een MCP-server op /api/mcp/<sleutel> (vercel.json zet dat om naar /api/mcp?sleutel=…).
// De sleutel staat als MCP_SLEUTEL in de omgeving van dit Vercel-project; klopt hij niet, dan volgt een kale 404.
// Alleen lezen van openbaar internet. Geen API-sleutels, geen kosten.

var INFO = {
  name: 'internet', version: '1.0.0',
  instructions: "Public internet for Harm's AI village: Google News (nl/en), Wikipedia, Hacker News, arXiv, and reading a web page by its address. Read-only. There is no general web search engine: search news, Wikipedia, Hacker News or arXiv, then read pages from the links you find. Always name your sources."
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

module.exports = async function handler(req, res) {
  var q = req.query || {};
  if (!sleutelKlopt(q.sleutel)) return stuur(res, 404, {});
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return stuur(res, 405, { error: 'Alleen POST' }); }
  var body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return stuur(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Geen geldige JSON' } }); } }
  var uit = await mcp.verwerk(body, web.maak(), INFO);
  if (uit === null) { res.statusCode = 202; return res.end(); }
  return stuur(res, 200, uit);
};
