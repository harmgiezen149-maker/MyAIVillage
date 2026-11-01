// Een kleine MCP-server: de deur waardoor Claude (Harms AI-dorp op claude.ai)
// het internet kan raadplegen: nieuws, Wikipedia, Hacker News, arXiv en losse webpagina's.
//
// MCP is JSON-RPC 2.0 over één POST-adres ("Streamable HTTP"). Deze server is
// staatloos: geen sessies, geen stream, elk verzoek krijgt een JSON-antwoord.
// Bewust zonder extra pakket, zodat je hier precies kunt lezen wat openstaat.

var PROTOCOLLEN = ['2025-06-18', '2025-03-26', '2024-11-05'];

// Een fout die als nette tekst terug mag naar Claude ("preset bestaat niet").
function McpFout(bericht) { this.message = bericht; }
McpFout.prototype = Object.create(Error.prototype);

function antwoord(id, result) { return { jsonrpc: '2.0', id: id === undefined ? null : id, result: result }; }
function fout(id, code, message) { return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code: code, message: message } }; }

async function behandel(b, gereedschap, info) {
  if (!b || typeof b !== 'object' || typeof b.method !== 'string') return fout(b && b.id, -32600, 'Ongeldig verzoek');
  var isMelding = b.id === undefined || b.id === null;
  var params = b.params || {};
  switch (b.method) {
    case 'initialize':
      return antwoord(b.id, {
        protocolVersion: PROTOCOLLEN.indexOf(String(params.protocolVersion)) !== -1 ? String(params.protocolVersion) : PROTOCOLLEN[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: info.name, version: info.version },
        instructions: info.instructions
      });
    case 'ping':
      return antwoord(b.id, {});
    case 'tools/list':
      return antwoord(b.id, { tools: gereedschap.map(function(g) {
        return { name: g.name, title: g.title, description: g.description, inputSchema: g.inputSchema,
          annotations: { title: g.title, readOnlyHint: g.alleenLezen, destructiveHint: false, idempotentHint: g.alleenLezen, openWorldHint: false } };
      }) });
    case 'tools/call': {
      var naam = String(params.name || '');
      var g = gereedschap.filter(function(x) { return x.name === naam; })[0];
      if (!g) return fout(b.id, -32602, 'Onbekend gereedschap: ' + naam);
      var args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
      try {
        var uit = await g.run(args);
        var res = { content: [{ type: 'text', text: JSON.stringify(uit) }] };
        if (uit && typeof uit === 'object' && !Array.isArray(uit)) res.structuredContent = uit;
        return antwoord(b.id, res);
      } catch (e) {
        if (!(e instanceof McpFout)) console.error('mcp', naam, e);
        return antwoord(b.id, { content: [{ type: 'text', text: e instanceof McpFout ? e.message : 'Er ging iets mis bij het ophalen van internet.' }], isError: true });
      }
    }
    default:
      if (isMelding || b.method.indexOf('notifications/') === 0) return null;
      return fout(b.id, -32601, 'Onbekende methode: ' + b.method);
  }
}

// Geeft null terug als er niets te antwoorden valt (alleen meldingen): dan 202.
async function verwerk(body, gereedschap, info) {
  if (Array.isArray(body)) {
    var uit = [];
    for (var i = 0; i < body.length; i++) { var a = await behandel(body[i], gereedschap, info); if (a) uit.push(a); }
    return uit.length ? uit : null;
  }
  return behandel(body, gereedschap, info);
}

module.exports = { verwerk: verwerk, McpFout: McpFout };
