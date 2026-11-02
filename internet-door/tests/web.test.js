var test = require('node:test');
var assert = require('node:assert');
var web = require('../api/_lib/web');
var mcp = require('../api/_lib/mcp');

// A fake internet: answers by address, so the tests run without a network.
function nepFetch(routes) {
  return async function(url, opts) {
    var hit = Object.keys(routes).find(function(k) { return url.indexOf(k) === 0; });
    if (!hit) return new Response('niet gevonden', { status: 404 });
    var r = routes[hit];
    return new Response(r.body, { status: r.status || 200, headers: r.headers || { 'content-type': r.type || 'text/html' } });
  };
}
var openbaar = async function() { return [{ address: '93.184.216.34', family: 4 }]; };
function gereedschap(routes, opzoeken) { return web.maak({ fetch: nepFetch(routes), opzoeken: opzoeken || openbaar }); }
async function roep(tools, name, args) {
  var out = await mcp.verwerk({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: name, arguments: args } }, tools, { name: 't', version: '1' });
  return { fout: !!out.result.isError, tekst: out.result.content[0].text, data: out.result.isError ? null : JSON.parse(out.result.content[0].text) };
}

test('alleen lezen, zeven bronnen', async function() {
  var lijst = await mcp.verwerk({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, web.maak(), { name: 't', version: '1' });
  var tools = lijst.result.tools;
  assert.deepEqual(tools.map(function(t) { return t.name; }), ['web_search', 'scholar', 'news_search', 'wikipedia', 'hacker_news', 'arxiv', 'read_page']);
  assert.ok(tools.every(function(t) { return t.annotations.readOnlyHint === true; }));
});

test('nieuws uit Google Nieuws (RSS)', async function() {
  var rss = '<rss><channel><item><title>AI-wet aangenomen &amp; meer</title><link>https://news.google.com/a1</link><pubDate>Sun, 01 Nov 2026 10:00:00 GMT</pubDate><source url="https://nos.nl">NOS</source></item>'
    + '<item><title><![CDATA[Tweede bericht]]></title><link>https://news.google.com/a2</link><pubDate>Sun, 01 Nov 2026 09:00:00 GMT</pubDate><source url="x">NU.nl</source></item></channel></rss>';
  var r = await roep(gereedschap({ 'https://news.google.com/rss/search?q=AI%20wet&hl=nl': { body: rss, type: 'application/rss+xml' } }), 'news_search', { query: 'AI wet' });
  assert.equal(r.data.aantal, 2);
  assert.deepEqual(r.data.berichten[0], { titel: 'AI-wet aangenomen & meer', bron: 'NOS', datum: 'Sun, 01 Nov 2026 10:00:00 GMT', link: 'https://news.google.com/a1' });
  assert.equal(r.data.berichten[1].titel, 'Tweede bericht');
});

test('wikipedia, hacker news en arxiv', async function() {
  var t = gereedschap({
    'https://nl.wikipedia.org/w/api.php': { body: JSON.stringify({ query: { search: [{ title: 'Boswachter', snippet: 'x' }] } }), type: 'application/json' },
    'https://nl.wikipedia.org/api/rest_v1/page/summary/Boswachter': { body: JSON.stringify({ title: 'Boswachter', extract: 'Een boswachter beheert bos.', content_urls: { desktop: { page: 'https://nl.wikipedia.org/wiki/Boswachter' } } }), type: 'application/json' },
    'https://hn.algolia.com/api/v1/search?tags=front_page': { body: JSON.stringify({ hits: [{ title: 'New model', url: 'https://ex.com', points: 300, num_comments: 120, created_at: '2026-11-01', objectID: '1' }] }), type: 'application/json' },
    'https://export.arxiv.org/api/query': { body: '<feed><entry><id>http://arxiv.org/abs/1</id><published>2026-10-30T00:00:00Z</published><title>Agents  that\n plan</title><summary>We study planning.</summary><author><name>A. Ai</name></author></entry></feed>', type: 'application/atom+xml' },
  });
  var w = await roep(t, 'wikipedia', { query: 'boswachter' });
  assert.equal(w.data.artikelen[0].samenvatting, 'Een boswachter beheert bos.');
  var hn = await roep(t, 'hacker_news', {});
  assert.equal(hn.data.verhalen[0].punten, 300);
  var ax = await roep(t, 'arxiv', { query: 'agents' });
  assert.equal(ax.data.artikelen[0].titel, 'Agents that plan');
  assert.deepEqual(ax.data.artikelen[0].auteurs, ['A. Ai']);
});

test('een webpagina lezen: leesbare tekst, zonder scripts en menu', async function() {
  var html = '<html><head><title>Artikel</title><script>evil()</script></head><body><nav>Menu</nav><article><h1>Kop</h1><p>Eerste alinea &amp; meer.</p><p>Tweede.</p></article><footer>voet</footer></body></html>';
  var r = await roep(gereedschap({ 'https://example.com/a': { body: html } }), 'read_page', { url: 'https://example.com/a' });
  assert.equal(r.data.titel, 'Artikel');
  assert.match(r.data.tekst, /Kop\nEerste alinea & meer\.\nTweede\./);
  assert.ok(r.data.tekst.indexOf('evil') === -1 && r.data.tekst.indexOf('Menu') === -1);
});

test('geen interne adressen, ook niet via doorverwijzing of DNS', async function() {
  var t = gereedschap({});
  for (var u of ['http://localhost/x', 'http://127.0.0.1/', 'http://10.0.0.1/', 'http://192.168.1.1/', 'http://[::1]/', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'https://example.com:8443/']) {
    var r = await roep(t, 'read_page', { url: u });
    assert.equal(r.fout, true, u);
  }
  var viaDns = await roep(web.maak({ fetch: nepFetch({}), opzoeken: async function() { return [{ address: '10.1.2.3', family: 4 }]; } }), 'read_page', { url: 'https://intern.example/' });
  assert.equal(viaDns.fout, true);
  var omweg = gereedschap({ 'https://example.com/r': { status: 302, body: '', headers: { location: 'http://127.0.0.1/admin' } } });
  var r2 = await roep(omweg, 'read_page', { url: 'https://example.com/r' });
  assert.equal(r2.fout, true);
  assert.match(r2.tekst, /Interne adressen/);
});

test('de deur: zonder juiste sleutel een kale 404', async function() {
  process.env.MCP_SLEUTEL = 'x'.repeat(43);
  var handler = require('../api/mcp');
  function res() { var r = { statusCode: 200, headers: {}, body: null }; r.status = function(c) { r.statusCode = c; return r; }; r.json = function(d) { r.body = d; return r; }; r.setHeader = function(k, v) { r.headers[k] = v; }; r.end = function() { r.klaar = true; }; return r; }
  var fout = res(); await handler({ method: 'POST', query: { sleutel: 'y'.repeat(43) }, body: {} }, fout);
  assert.equal(fout.statusCode, 404);
  var goed = res(); await handler({ method: 'POST', query: { sleutel: 'x'.repeat(43) }, body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } } }, goed);
  assert.equal(goed.body.result.serverInfo.name, 'internet');
  var melding = res(); await handler({ method: 'POST', query: { sleutel: 'x'.repeat(43) }, body: { jsonrpc: '2.0', method: 'notifications/initialized' } }, melding);
  assert.equal(melding.statusCode, 202);
  // the key straight from the address, and the body read from the stream
  var { Readable } = require('stream');
  var stroom = Readable.from([Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))]);
  stroom.method = 'POST'; stroom.url = '/api/mcp/' + 'x'.repeat(43); stroom.query = {};
  var uitStroom = res(); await handler(stroom, uitStroom);
  assert.equal(uitStroom.body.result.tools.length, 7);
  delete process.env.MCP_SLEUTEL;
  var zonder = res(); await handler({ method: 'POST', query: { sleutel: '' }, body: {} }, zonder);
  assert.equal(zonder.statusCode, 404, 'zonder ingestelde sleutel is de deur dicht');
});

var GN = '<rss><channel><item><title>Muziek helpt slapen - NOS</title><link>https://news.google.com/x1</link><pubDate>Sun, 01 Nov 2026</pubDate><source url="https://nos.nl">NOS</source></item></channel></rss>';
var BING = '<rss xmlns:News="https://www.bing.com/news/search?q=x&amp;format=rss"><channel><item><title>Slaap en muziek</title>'
  + '<link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=1&amp;url=https%3a%2f%2fwww.ad.nl%2fslaap&amp;c=2</link>'
  + '<description>Rustige muziek &amp; slaap.</description><pubDate>Sat, 31 Oct 2026</pubDate><News:Source>AD</News:Source></item>'
  + '<item><title>Dubbel</title><link>https://nos.nl/a?x=1</link><description>d</description></item></channel></rss>';
var WIKI = JSON.stringify({ query: { search: [{ title: 'Slaap', snippet: '<span>Slaap</span> is rust' }] } });

test('breed zoeken: Google Nieuws, Bing Nieuws, Wikipedia en Marginalia gemengd', async function() {
  var t = gereedschap({
    'https://news.google.com/rss/search?q=muziek%20slaap': { body: GN, type: 'application/rss+xml' },
    'https://www.bing.com/news/search?format=rss&q=muziek%20slaap': { body: BING, type: 'application/rss+xml' },
    'https://nl.wikipedia.org/w/api.php': { body: WIKI, type: 'application/json' },
    'https://api.marginalia.nu/': { body: JSON.stringify({ results: [{ url: 'https://klein.example/c', title: 'Klein web', description: 'd' }] }), type: 'application/json' },
  });
  var r = await roep(t, 'web_search', { query: 'muziek slaap' });
  assert.equal(r.fout, false, r.tekst);
  assert.deepEqual(r.data.resultaten.map(function(x) { return x.link; }), ['https://news.google.com/x1', 'https://www.ad.nl/slaap', 'https://nl.wikipedia.org/wiki/Slaap', 'https://klein.example/c', 'https://nos.nl/a?x=1']);
  assert.equal(r.data.resultaten[1].bron, 'Bing Nieuws · AD');
  assert.equal(r.data.resultaten[1].fragment, 'Rustige muziek & slaap.');
  assert.equal(r.data.resultaten[2].fragment, 'Slaap is rust');
  assert.deepEqual(r.data.bronnen, ['Google Nieuws', 'Bing Nieuws', 'Wikipedia', 'Marginalia']);
});

test('breed zoeken: valt een bron uit, dan tellen de andere; niets gevonden is een nette melding', async function() {
  var t = gereedschap({
    'https://news.google.com/': { status: 503, body: '' },
    'https://www.bing.com/news/search': { body: BING, type: 'application/rss+xml' },
    'https://api.marginalia.nu/': { status: 500, body: '' },
  });
  var r = await roep(t, 'web_search', { query: 'muziek slaap' });
  assert.equal(r.fout, false);
  assert.equal(r.data.aantal, 2);
  assert.ok(r.data.niet_gelukt.some(function(x) { return /Google Nieuws/.test(x); }));
  var niets = await roep(gereedschap({}), 'web_search', { query: 'x' });
  assert.equal(niets.fout, true);
  assert.match(niets.tekst, /Niets gevonden/);
});

test('wetenschap via OpenAlex: samenvatting terug in volgorde, open link', async function() {
  var t = gereedschap({ 'https://api.openalex.org/works?search=sleep%20music': { type: 'application/json', body: JSON.stringify({ meta: { count: 1234 }, results: [{
    display_name: 'Music for sleep', publication_year: 2024, cited_by_count: 87, doi: 'https://doi.org/10.1/x',
    authorships: [{ author: { display_name: 'A. Slaap' } }], primary_location: { source: { display_name: 'Sleep Journal' } },
    open_access: { oa_url: 'https://open.example/paper.pdf' }, abstract_inverted_index: { Music: [0], improves: [1], sleep: [2] } }] }) } });
  var r = await roep(t, 'scholar', { query: 'sleep music' });
  assert.equal(r.data.totaal_gevonden, 1234);
  assert.deepEqual(r.data.artikelen[0], { titel: 'Music for sleep', jaar: 2024, auteurs: ['A. Slaap'], tijdschrift: 'Sleep Journal', geciteerd: 87, samenvatting: 'Music improves sleep', link: 'https://open.example/paper.pdf' });
});
