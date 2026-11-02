// Zelftest: werken de zoekmachines vanaf Vercel? Vaste zoekwoorden, alleen aantallen en de eerste titel per bron.
// Geen sleutel nodig: er gaat niets van Harm in of uit. Hooguit 12 keer per uur per instantie.
var mcp = require('./_lib/mcp');
var web = require('./_lib/web');

var teller = { uur: -1, aantal: 0 };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  var uur = Math.floor(Date.now() / 3600000);
  if (teller.uur !== uur) { teller.uur = uur; teller.aantal = 0; }
  if (++teller.aantal > 12) return res.status(429).json({ fout: 'Te vaak; probeer het volgend uur.' });
  var tools = web.maak();
  var roep = async function(name, args) {
    var out = await mcp.verwerk({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: name, arguments: args } }, tools, { name: 'zelftest', version: '1' });
    var r = out.result;
    if (r.isError) return { gelukt: false, melding: r.content[0].text.slice(0, 300) };
    var d = JSON.parse(r.content[0].text);
    var lijst = d.resultaten || d.artikelen || d.berichten || [];
    return { gelukt: true, aantal: lijst.length, bronnen: d.bronnen, niet_gelukt: d.niet_gelukt, eerste: lijst[0] && (lijst[0].titel || '') };
  };
  var uit = {};
  uit.web_nl = await roep('web_search', { query: 'muziek en slaap tips', lang: 'nl' });
  uit.web_en = await roep('web_search', { query: 'music and sleep quality', lang: 'en' });
  uit.scholar = await roep('scholar', { query: 'music sleep quality', max: 3 });
  uit.news = await roep('news_search', { query: 'slaap', max: 3 });
  return res.status(200).json(uit);
};
