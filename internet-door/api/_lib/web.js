// Het internet voor Harms AI-dorp, zonder API-sleutels en zonder kosten (Harm, 2026-11-01).
//
// Bronnen die gratis en zonder sleutel open staan:
// - Google Nieuws (RSS): actueel nieuws per onderwerp, Nederlands of Engels
// - Wikipedia: zoeken en samenvattingen
// - Hacker News (Algolia): tech- en AI-nieuws en discussies
// - arXiv: wetenschappelijke artikelen
// - een webpagina lezen: de tekst van één adres
// - breed zoeken (Harm, 2026-11-01: "veel breder zoeken"): Google Nieuws en Bing Nieuws (artikelen van
//   duizenden sites, ook ouder), Wikipedia en de onafhankelijke zoekmachine Marginalia, tegelijk en gemengd.
//   DuckDuckGo en Mojeek weigeren verzoeken van servers (403); die omzeilen we niet door ons als browser
//   voor te doen. Bronnen die automatisch gebruik toestaan, wel.
// - wetenschap (OpenAlex): meer dan 250 miljoen artikelen uit alle vakgebieden, met citaties en samenvatting
//
// Alles is alleen lezen. Een webpagina lezen gaat alleen naar openbare adressen (geen interne netwerken).

var dns = require('dns').promises;
var net = require('net');
var mcp = require('./mcp');

var UA = 'MijnAIDorp/1.0 (persoonlijk gebruik; https://github.com/harmgiezen149-maker/MyAIVillage)';
var TIMEOUT_MS = 12000;
var MAX_BYTES = 1500000;

function tekst(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 300); }
function aantal(v, standaard, max) { var n = Number(v); return Number.isFinite(n) && n >= 1 ? Math.min(max, Math.floor(n)) : standaard; }

var ENTITEITEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', euro: '€', eacute: 'é', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', egrave: 'è', agrave: 'à', ccedil: 'ç' };
function ontsleutel(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, function(_, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function(_, d) { return String.fromCodePoint(Number(d)); })
    .replace(/&([a-z]+);/gi, function(m, n) { return ENTITEITEN[n.toLowerCase()] != null ? ENTITEITEN[n.toLowerCase()] : m; });
}
function tag(xml, naam) {
  var m = new RegExp('<' + naam + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + naam + '>', 'i').exec(xml);
  return m ? ontsleutel(m[1]).trim() : '';
}
function blokken(xml, naam) {
  var uit = [], re = new RegExp('<' + naam + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + naam + '>', 'gi'), m;
  while ((m = re.exec(xml))) uit.push(m[0]);
  return uit;
}

// ---------- veilig ophalen ----------

function priveAdres(ip) {
  if (net.isIPv4(ip)) {
    var p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
      || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
  }
  var s = ip.toLowerCase();
  if (s.indexOf('::ffff:') === 0) return priveAdres(s.slice(7));
  return s === '::1' || s === '::' || s.indexOf('fc') === 0 || s.indexOf('fd') === 0 || s.indexOf('fe80') === 0;
}

async function controleerAdres(url, opzoeken) {
  var u;
  try { u = new URL(url); } catch (e) { throw new mcp.McpFout('Dat is geen geldig webadres.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new mcp.McpFout('Alleen http- en https-adressen.');
  if (u.username || u.password) throw new mcp.McpFout('Adressen met een inlognaam erin worden niet gelezen.');
  if (u.port && u.port !== '80' && u.port !== '443') throw new mcp.McpFout('Alleen gewone webadressen (poort 80 of 443).');
  var host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new mcp.McpFout('Interne adressen worden niet gelezen.');
  var adressen = net.isIP(host) ? [host] : (await (opzoeken || dns.lookup)(host, { all: true })).map(function(a) { return a.address; });
  if (!adressen.length || adressen.some(priveAdres)) throw new mcp.McpFout('Interne adressen worden niet gelezen.');
  return u;
}

// Haalt een adres op, met hooguit 4 doorverwijzingen; elk adres onderweg wordt opnieuw gecontroleerd.
// opties.wacht: andere tijdslimiet in ms (standaard 12 s).
async function haal(url, opties) {
  opties = opties || {};
  var f = opties.fetch || fetch;
  var huidig = url;
  for (var stap = 0; stap < 5; stap++) {
    var u = await controleerAdres(huidig, opties.opzoeken);
    var res = await f(u.toString(), {
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Accept': opties.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'nl,en;q=0.8' },
      signal: AbortSignal.timeout(opties.wacht || TIMEOUT_MS)
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { huidig = new URL(res.headers.get('location'), u).toString(); continue; }
    if (!res.ok) throw new mcp.McpFout('De pagina gaf een fout (' + res.status + ').');
    var lezer = res.body && res.body.getReader ? res.body.getReader() : null;
    if (!lezer) return { url: u.toString(), type: res.headers.get('content-type') || '', body: await res.text() };
    var delen = [], totaal = 0;
    for (;;) {
      var r = await lezer.read();
      if (r.done) break;
      totaal += r.value.length;
      if (totaal > MAX_BYTES) { lezer.cancel().catch(function() {}); break; }
      delen.push(r.value);
    }
    return { url: u.toString(), type: res.headers.get('content-type') || '', body: Buffer.concat(delen.map(function(d) { return Buffer.from(d); })).toString('utf8') };
  }
  throw new mcp.McpFout('Te veel doorverwijzingen.');
}

// ---------- een webpagina als leesbare tekst ----------

function leesbareTekst(html) {
  var titel = tag(html, 'title');
  var kern = (/<article[\s\S]*?<\/article>/i.exec(html) || /<main[\s\S]*?<\/main>/i.exec(html) || /<body[\s\S]*<\/body>/i.exec(html) || [html])[0];
  var t = kern
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ');
  t = ontsleutel(t).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { titel: titel, tekst: t };
}

// ---------- zoeken op het web ----------

function schoon(html) { return ontsleutel(String(html || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(); }

// Bing Nieuws als RSS: de link loopt via bing.com/news/apiclick.aspx?...&url=<het echte adres>.
function leesBingNieuws(xml) {
  return blokken(xml, 'item').map(function(it) {
    var link = tag(it, 'link');
    var echt = /[?&]url=([^&]+)/.exec(link);
    if (echt) { try { link = decodeURIComponent(echt[1]); } catch (e) { /* laat staan */ } }
    var bron = /<News:Source>([\s\S]*?)<\/News:Source>/i.exec(it);
    return { titel: tag(it, 'title'), link: link, fragment: schoon(tag(it, 'description')).slice(0, 300), datum: tag(it, 'pubDate'), bron: 'Bing Nieuws' + (bron ? ' · ' + ontsleutel(bron[1]).trim() : '') };
  }).filter(function(x) { return /^https?:\/\//.test(x.link); });
}

function leesGoogleNieuws(xml) {
  return blokken(xml, 'item').map(function(it) {
    var bron = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(it);
    return { titel: tag(it, 'title'), link: tag(it, 'link'), fragment: '', datum: tag(it, 'pubDate'), bron: 'Google Nieuws' + (bron ? ' · ' + ontsleutel(bron[1]).trim() : '') };
  }).filter(function(x) { return /^https?:\/\//.test(x.link); });
}

function leesMarginalia(data) {
  return ((data && data.results) || []).map(function(r) { return { titel: tekst(r.title, 200), link: String(r.url || ''), fragment: tekst(r.description, 300), bron: 'Marginalia' }; })
    .filter(function(x) { return /^https?:\/\//.test(x.link); });
}

function sleutelVan(link) { try { var u = new URL(link); return (u.host.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search).toLowerCase(); } catch (e) { return link; } }

// Om en om uit elke zoekmachine, zonder dubbele adressen: zo komt het beste van elk bovenaan.
function meng(lijsten, max) {
  var gezien = new Set(), uit = [];
  for (var i = 0; uit.length < max && lijsten.some(function(l) { return i < l.length; }); i++) {
    for (var l of lijsten) {
      var x = l[i];
      if (!x || uit.length >= max) continue;
      var k = sleutelVan(x.link);
      if (gezien.has(k)) continue;
      gezien.add(k); uit.push(x);
    }
  }
  return uit;
}

// OpenAlex geeft de samenvatting als "woord -> posities"; dit zet hem terug in volgorde.
function samenvattingUit(index) {
  if (!index) return '';
  var woorden = [];
  Object.keys(index).forEach(function(w) { index[w].forEach(function(p) { woorden[p] = w; }); });
  return woorden.filter(Boolean).join(' ');
}

// ---------- de bronnen ----------

function maak(opties) {
  opties = opties || {};
  var h = function(url, accept) { return haal(url, { fetch: opties.fetch, opzoeken: opties.opzoeken, accept: accept }); };
  var json = async function(url) { var r = await h(url, 'application/json'); try { return JSON.parse(r.body); } catch (e) { throw new mcp.McpFout('De bron gaf geen leesbaar antwoord.'); } };

  return [
    { name: 'web_search', title: 'Breed zoeken', alleenLezen: true,
      description: 'Broad search across the web at once: Google News and Bing News (articles from thousands of sites, also older ones), Wikipedia and the independent search engine Marginalia, mixed together. Returns titles, links, source, date and a snippet. Then use read_page on the best links. lang "nl" (default) or "en" (international). Search again with other words (and the other language) for a broader picture.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, lang: { type: 'string', enum: ['nl', 'en'] }, max: { type: 'number', description: 'default 12, at most 25' } }, required: ['query'] },
      run: async function(a) {
        var q = tekst(a.query, 300);
        if (!q) throw new mcp.McpFout('Waar moet ik naar zoeken?');
        var en = a.lang === 'en', max = aantal(a.max, 12, 25), lang = en ? 'en' : 'nl';
        var gelukt = [], mislukt = [];
        var probeer = async function(naam, doe) {
          try { var r = await doe(); (r.length ? gelukt : mislukt).push(r.length ? naam : naam + ' (niets gevonden)'); return r; }
          catch (e) { mislukt.push(naam + ' (' + (e && e.message ? e.message : 'fout') + ')'); return []; }
        };
        var lijsten = await Promise.all([
          probeer('Google Nieuws', async function() { return leesGoogleNieuws((await h('https://news.google.com/rss/search?q=' + encodeURIComponent(q) + (en ? '&hl=en-US&gl=US&ceid=US:en' : '&hl=nl&gl=NL&ceid=NL:nl'), 'application/rss+xml,application/xml')).body); }),
          probeer('Bing Nieuws', async function() { return leesBingNieuws((await h('https://www.bing.com/news/search?format=rss&q=' + encodeURIComponent(q) + (en ? '&setlang=en-US&cc=US' : '&setlang=nl-NL&cc=NL'), 'application/rss+xml,application/xml')).body); }),
          probeer('Wikipedia', async function() {
            var d = await json('https://' + lang + '.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=4&srsearch=' + encodeURIComponent(q));
            return ((d.query && d.query.search) || []).map(function(x) { return { titel: x.title, link: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(x.title.replace(/ /g, '_')), fragment: schoon(x.snippet), bron: 'Wikipedia' }; });
          }),
          probeer('Marginalia', async function() { return leesMarginalia(JSON.parse((await haal('https://api.marginalia.nu/public/search/' + encodeURIComponent(q) + '?count=8', { fetch: opties.fetch, opzoeken: opties.opzoeken, accept: 'application/json', wacht: 5000 })).body)); }),
        ]);
        var resultaten = meng(lijsten, max);
        if (!resultaten.length) throw new mcp.McpFout('Niets gevonden (' + mislukt.join('; ') + '). Probeer andere of minder woorden, of de andere taal.');
        var volgorde = ['Google Nieuws', 'Bing Nieuws', 'Wikipedia', 'Marginalia'];
        return { zoekterm: q, taal: lang, aantal: resultaten.length, bronnen: volgorde.filter(function(n) { return gelukt.indexOf(n) >= 0; }), niet_gelukt: mislukt, resultaten: resultaten };
      } },
    { name: 'scholar', title: 'Wetenschappelijk onderzoek', alleenLezen: true,
      description: 'Search scientific research in ALL fields (medicine, sleep, psychology, nature, economics, technology...) via OpenAlex: over 250 million papers. Returns title, year, authors, journal, how often it was cited, a short abstract and a link (open-access link when there is one). sort "relevance" (default), "cited" (most cited first) or "newest".',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, sort: { type: 'string', enum: ['relevance', 'cited', 'newest'] }, max: { type: 'number', description: 'default 6, at most 15' } }, required: ['query'] },
      run: async function(a) {
        var q = tekst(a.query, 300);
        if (!q) throw new mcp.McpFout('Waar moet ik onderzoek naar zoeken?');
        var sort = { cited: '&sort=cited_by_count:desc', newest: '&sort=publication_date:desc' }[a.sort] || '';
        var d = await json('https://api.openalex.org/works?search=' + encodeURIComponent(q) + '&per-page=' + aantal(a.max, 6, 15) + sort);
        return { zoekterm: q, totaal_gevonden: (d.meta && d.meta.count) || 0, artikelen: (d.results || []).map(function(w) {
          var loc = w.primary_location || {}, oa = w.open_access || {};
          return { titel: tekst(w.display_name || w.title, 300), jaar: w.publication_year || null,
            auteurs: (w.authorships || []).slice(0, 5).map(function(x) { return x.author && x.author.display_name; }).filter(Boolean),
            tijdschrift: (loc.source && loc.source.display_name) || '', geciteerd: w.cited_by_count || 0,
            samenvatting: tekst(samenvattingUit(w.abstract_inverted_index), 900),
            link: oa.oa_url || w.doi || loc.landing_page_url || w.id || '' };
        }) };
      } },
    { name: 'news_search', title: 'Nieuws zoeken', alleenLezen: true,
      description: 'Recent news about a topic from Google News (titles, source, date, link). lang "nl" (Dutch news, default) or "en" (international). Use specific search words.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, lang: { type: 'string', enum: ['nl', 'en'] }, max: { type: 'number', description: 'default 10' } }, required: ['query'] },
      run: async function(a) {
        var q = tekst(a.query, 200);
        if (!q) throw new mcp.McpFout('Waar moet ik nieuws over zoeken?');
        var en = a.lang === 'en';
        var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + (en ? '&hl=en-US&gl=US&ceid=US:en' : '&hl=nl&gl=NL&ceid=NL:nl');
        var xml = (await h(url, 'application/rss+xml,application/xml')).body;
        var items = blokken(xml, 'item').slice(0, aantal(a.max, 10, 25)).map(function(it) {
          var bron = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(it);
          return { titel: tag(it, 'title'), bron: bron ? ontsleutel(bron[1]).trim() : '', datum: tag(it, 'pubDate'), link: tag(it, 'link') };
        });
        return { zoekterm: q, taal: en ? 'en' : 'nl', aantal: items.length, berichten: items };
      } },
    { name: 'wikipedia', title: 'Wikipedia', alleenLezen: true,
      description: 'Look something up on Wikipedia: the best matching articles with a short summary and link. lang "nl" (default) or "en".',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, lang: { type: 'string', enum: ['nl', 'en'] } }, required: ['query'] },
      run: async function(a) {
        var q = tekst(a.query, 200);
        if (!q) throw new mcp.McpFout('Wat moet ik opzoeken?');
        var lang = a.lang === 'en' ? 'en' : 'nl';
        var zoek = await json('https://' + lang + '.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=' + encodeURIComponent(q));
        var hits = (zoek.query && zoek.query.search) || [];
        var artikelen = [];
        for (var i = 0; i < hits.length; i++) {
          var titel = hits[i].title;
          try {
            var s = await json('https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(titel.replace(/ /g, '_')));
            artikelen.push({ titel: s.title || titel, samenvatting: tekst(s.extract, 1500), link: (s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || '' });
          } catch (e) { artikelen.push({ titel: titel, samenvatting: ontsleutel(String(hits[i].snippet || '').replace(/<[^>]+>/g, '')), link: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(titel.replace(/ /g, '_')) }); }
        }
        return { zoekterm: q, taal: lang, artikelen: artikelen };
      } },
    { name: 'hacker_news', title: 'Hacker News', alleenLezen: true,
      description: 'Tech and AI stories from Hacker News: search a topic (newest first), or leave query out for the current front page. Returns title, link, points, comments, date.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, max: { type: 'number', description: 'default 10' } } },
      run: async function(a) {
        var q = tekst(a.query, 200), n = aantal(a.max, 10, 30);
        var url = q ? 'https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=' + n + '&query=' + encodeURIComponent(q)
          : 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=' + n;
        var d = await json(url);
        return { zoekterm: q || '(voorpagina)', verhalen: (d.hits || []).map(function(x) {
          return { titel: x.title || '', link: x.url || ('https://news.ycombinator.com/item?id=' + x.objectID), punten: x.points || 0, reacties: x.num_comments || 0,
            datum: x.created_at || '', discussie: 'https://news.ycombinator.com/item?id=' + x.objectID };
        }) };
      } },
    { name: 'arxiv', title: 'arXiv', alleenLezen: true,
      description: 'Newest scientific papers on arXiv about a topic (title, authors, date, short abstract, link). Good for AI and science research.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, max: { type: 'number', description: 'default 5' } }, required: ['query'] },
      run: async function(a) {
        var q = tekst(a.query, 200);
        if (!q) throw new mcp.McpFout('Waar moet ik artikelen over zoeken?');
        var url = 'https://export.arxiv.org/api/query?sortBy=submittedDate&sortOrder=descending&max_results=' + aantal(a.max, 5, 15) + '&search_query=all:' + encodeURIComponent('"' + q.replace(/"/g, '') + '"');
        var xml = (await h(url, 'application/atom+xml,application/xml')).body;
        return { zoekterm: q, artikelen: blokken(xml, 'entry').map(function(e) {
          return { titel: tag(e, 'title').replace(/\s+/g, ' '), auteurs: blokken(e, 'author').map(function(x) { return tag(x, 'name'); }).slice(0, 6),
            datum: tag(e, 'published').slice(0, 10), samenvatting: tekst(tag(e, 'summary').replace(/\s+/g, ' '), 700), link: tag(e, 'id') };
        }) };
      } },
    { name: 'read_page', title: 'Webpagina lezen', alleenLezen: true,
      description: 'Read the text of one public web page (an http/https address, e.g. a news article or a page you found). Returns its title and readable text (cut at about 12,000 characters).',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      run: async function(a) {
        var r = await h(tekst(a.url, 2000));
        if (!/html|text\/plain|xml/i.test(r.type)) throw new mcp.McpFout('Dit is geen webpagina met tekst (' + (r.type || 'onbekend') + ').');
        var l = /html/i.test(r.type) ? leesbareTekst(r.body) : { titel: '', tekst: r.body };
        return { adres: r.url, titel: l.titel, tekst: l.tekst.slice(0, 12000), ingekort: l.tekst.length > 12000 };
      } }
  ];
}

module.exports = { maak: maak, _leesBingNieuws: leesBingNieuws, _meng: meng, _haal: haal, _leesbareTekst: leesbareTekst, _priveAdres: priveAdres };
