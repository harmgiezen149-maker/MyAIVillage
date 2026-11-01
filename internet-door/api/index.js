// De voorpagina zegt alleen wat dit is; de deur zelf zit op /api/mcp/<sleutel>.
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Internet-deur voor Mijn AI-dorp. Alleen bruikbaar met de sleutel, als connector op claude.ai.');
};
