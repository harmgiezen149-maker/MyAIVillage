# Internet-deur voor Mijn AI-dorp

Een kleine MCP-server (connector) waarmee de bewoners van het AI-dorp op claude.ai het openbare internet kunnen raadplegen.
Alleen lezen, zonder API-sleutels en zonder kosten.

| Gereedschap | Wat het doet | Bron |
|---|---|---|
| `news_search` | Actueel nieuws over een onderwerp (nl of en) | Google Nieuws RSS |
| `wikipedia` | Artikelen en samenvattingen | Wikipedia API |
| `hacker_news` | Tech- en AI-verhalen, of de voorpagina | Hacker News (Algolia) |
| `arxiv` | Nieuwste wetenschappelijke artikelen | arXiv API |
| `read_page` | De tekst van één openbare webpagina | het adres zelf |

- Adres: `https://<project>.vercel.app/api/mcp/<sleutel>`. De sleutel staat als `MCP_SLEUTEL` in de omgeving van het Vercel-project; een verkeerde sleutel geeft een kale 404.
- `read_page` leest alleen openbare adressen (geen localhost of interne netwerken, ook niet via doorverwijzingen of DNS), hooguit 1,5 MB, 12 seconden.
- Een gewone zoekmachine zit er niet in: die kan niet zonder betaalde sleutel.
- Tests: `npm test` (zonder netwerk, met een nep-internet).
