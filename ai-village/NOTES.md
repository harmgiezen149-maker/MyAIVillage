# My AI Village — Decision Notes

Running log of every decision made during the build. Newest entries at the bottom.

## Ground rules (2026-10-30)

- **Roles:** Harm is the director and describes what to build in plain words. Claude builds it.
- **Format:** A web page that runs on Harm's own computer. Everything lives in the `ai-village` folder.
- **Higgsfield = Artlist:** When a prompt mentions Higgsfield, use Artlist instead.
- **Subscriptions only:** No API keys and no pay-per-use services. Claude double-checks this and confirms it before building anything that runs on its own.
- **Artlist credits:** Ask before spending credits on a batch, with a rough credit estimate.
- **Notes:** Every decision is logged in this file.
- **Review:** When a piece is finished, show it to Harm before moving on.
- **Ask first:** Before creating, overwriting or deleting files, running anything on Harm's computer, or spending anything, explain in plain words and wait for a yes.

## Setup decisions (2026-10-30)

- Claude works in a cloud workspace, not on Harm's computer. The build is saved to the GitHub repo `harmgiezen149-maker/MyAIVillage` (branch `ccr-c84a7ded-swehau`). Harm downloads it and opens the page locally.
- The page is plain HTML/JavaScript with no API keys, outside servers or paid services.
- Artlist is used only through Claude's chat connection. Generated assets (images, music, etc.) are saved as files in the folder. The page never calls Artlist itself.
- This notes file is pushed to GitHub after every change so it survives between sessions.
- Artlist balance at start: 1,340 of 16,500 monthly credits (AI Suite 16500 plan), renews 2026-11-07.

## Village vision (2026-10-30)

- **Style:** Top-down, high-detail 16-bit RPG village.
- **Purpose:** Each of Harm's AI agents will live and work in the village, in their own house.
- **First milestone — empty town:** Build the whole town with nobody in it: houses, paths, trees, a town square, and a town hall.
- **Interiors:** Every house can be walked into (each has its own interior).
- **Not yet decided:** How the artwork is made (Artlist-generated vs. drawn in code), map size, number of houses. Claude proposes these before building and waits for a yes.

## Art style (2026-10-30)

- The style guide lives in `STYLE_GUIDE.md` (approved by Harm as written). Replaced by the HD-2D version later the same day; see "Style change" below.
- Every art prompt includes the style guide paragraph **word for word**.
- Harm's original style brief: 16-bit SNES pixel art, warm colors, top-down three-quarter view, light from the upper left, dark outlines, no text anywhere.

## Town map choice (2026-10-30)

- Harm picked **map 2: Medieval Europe** as the town map.
- Saved as `art/maps/2-medieval-europe.png` (2048 × 2048, uploaded by Harm because the download was blocked).
- Check against the brief: 10 houses ✓, town hall with bell tower on the north side ✓, cobblestone square ✓, paths ✓, open yards ✓, grass and trees ✓, no people ✓, no text ✓.
- Problems found: the centerpiece is a stone well rather than a fountain; the two tall tile-roof houses (left and right of the square) are tucked behind thatched cottages, so their front doors can't be seen; there's a tiny stray yellow object just right of the square.

## Style change in progress (2026-10-30)

- Harm wants a more modern RPG look than 16-bit SNES pixel art.
- For the modern-look drafts, the style guide's pixel-art lines were left out; the warm palette, three-quarter view, upper-left light and no-text rules were kept.
- Once Harm picks a look, `STYLE_GUIDE.md` gets rewritten to match (with Harm's yes).
- **Done:** `STYLE_GUIDE.md` rewritten for HD-2D and approved by Harm as written. The old pixel-art paragraph is kept below it as a record. From now on, every art prompt uses the HD-2D paragraph word for word.
- Outline check done: the 4K map has dark outlines, so "subtle dark outlines" stays.

## Look chosen (2026-10-30)

- Harm chose the **HD-2D** look (draft 1) for the town map.
- Town map format: **4:3 landscape** to fit desktop screens (2K version chosen over 4K to save credits).

## Agents and their buildings (2026-10-31)

Each building's outside matches its agent's job (medieval version of the job, symbols only, no text). Each has an accent color.

| Building (position on map) | Agent / job | Design | Accent |
|---|---|---|---|
| Town hall (top center) | Chief of staff | "Council Hall": nine banners in every house's color, flagpole, blank clock face, council table with map | all nine |
| Right of town hall (upper right) | Inbox & email | "Post House": empty dovecote, letter chest, post horn, sorting cubbies, wax seals | sky blue |
| Left of town hall (upper left) | Research | "Scholar's Tower": round tower with telescope, books, scrolls, ivy, reading bench | indigo |
| Far upper left | Money | "Counting House": stone ground floor, iron-banded door, barred windows, gilded disc sign, scales, strongbox | gold + deep green |
| Tall house far left | (spare) | Guest house for a future agent | — |
| Lower left (bench, flower beds) | Family | "Family Cottage": garden, swing, washing line, picnic table, toy cart, heart shutters | rose |
| Bottom left (by south road) | Logistics | "Carrier's Depot": cart, crates, barrels, lean-to, signpost with blank arrows | rust orange |
| Bottom right (by south road) | Outreach | "Herald's Lodge": pennants, welcoming porch, lanterns, horn, beacon | red |
| Lower right | Music | "Bard's House": bandstand porch, lute and drum, wind chimes, lute weathervane | plum purple |
| Tall house far right | Products | "Artisan's Workshop": open workshop doors, workbench, striped awning, display stall, forge chimney | teal |
| Upper right (below post house) | AI news | "Crier's Press": printing press, notice board with blank papers, bell, glowing crystal orb | silver + cyan |

## How the build log works (2026-10-30)

- Every session gets an entry with: date, start and end time, Artlist credit balance before and after, Claude usage before and after, and what was built.
- Claude checks the Artlist balance itself at the start and end of each session.
- At the start and end of each session, Claude reminds Harm to check the Claude usage screen (claude.ai → Settings → Usage) and logs the numbers Harm reports.
- Hitting a Claude usage limit, or paying for extra usage, is logged in that session's entry.
- When the build is done, Claude adds a final total: hours, Artlist credits used and their cost (price per credit still to be decided), Harm's Claude plan, and any extra usage.
- Times are logged in UTC, with Dutch local time in brackets.

## Build log

### Day 1 — 2026-10-30

- **Day 1, start (logged 17:33 UTC / 18:33 CET):** Artlist 1,340 of 16,500 credits · Claude usage 9% of plan
- **Session opened:** ~17:25 UTC (18:25 CET)
- **End:** _open_
- **Artlist credits:** start 1,340 / end _open_
- **Claude usage:** start 9% of plan / end _open_
- **Claude plan:** Pro
- **Usage limits / extra usage:** none so far
- **Built:**
  - `ai-village` folder and `NOTES.md` with ground rules, setup decisions and build-log rules.
  - `STYLE_GUIDE.md` (approved art style paragraph).
  - Town map batch: 5 versions, one per period (Ancient Rome, Medieval Europe, Edo Japan, Victorian England, Wild West). Nano Banana 2, 2K, square. 130 credits each, **650 credits total** (approved by Harm). Balance after: 690.
    - Images live in Harm's Artlist generations. Download into the workspace was blocked by the session's network policy (Artlist hosts not on the allowed list).
  - Modern-look drafts: Harm found map 2 too pixelated and wants a more modern RPG feel. 5 low-res drafts redrawing map 2 with the same layout (HD-2D, hand-painted, modern hi-res pixel art, cel-shaded 3D, cozy miniature diorama). Same prompts also asked for a fountain instead of the well, visible doors on the two hidden houses, and removing the stray object. Nano Banana 2 Lite, 1K. 50 credits each, **250 credits total** (approved by Harm). Balance after: 440.
  - Harm picked **draft 1: HD-2D**. Redrawn at 4K (4096 × 4096) from draft 1, Nano Banana 2, **200 credits** (approved by Harm). Uploaded by Harm and saved as `art/maps/town-hd2d-4k.png` (4096 × 4096).
    - Check: fountain ✓ (well replaced), stray yellow object gone ✓, 10 houses and town hall unchanged ✓, no people or text ✓, dark outlines present ✓ (so the style guide's outline line stays). Added extras: flower beds and benches. Still wrong: the two tall tile-roof houses (far left and far right) still have their front walls hidden behind thatched cottages. Look is still quite close to pixel art, with softer light and a sunlit glow upper left.
  - 4:3 town map for desktop screens: redrawn from the 4K HD-2D map with the new style guide, town kept centered, extra grass and trees on the sides. Nano Banana 2, 2K (2048 × 1536), **130 credits** (approved by Harm). This is the main town map from now on.

### Day 2 — 2026-10-31

- **Artlist plan upgraded by Harm:** now **AI Suite 40K** (40,000 credits/month, renews 2026-11-07). Balance at start of Day 2: 23,610 credits.
- **Claude usage:** start _not yet reported_ / end _open_
- **Built:**
  - Job-themed town map: one 2K edit of the 4:3 map giving every building its agent's look (see "Agents and their buildings"). Nano Banana 2, **130 credits**. Balance after: 23,480.
    - Uploaded by Harm, saved as `art/maps/town-jobs-4x3.png` (2400 × 1792).
    - The edit added buildings: now 13 houses + town hall + a separate teal market stall (was 10 houses). New plain tile house far top-left; new carrier's depot bottom-left; artisan's workshop is a new house far right.
    - Job looks that came out right: Post House, Crier's Press (glowing orb), Scholar's Tower (telescope), Counting House (gilded disc), Carrier's Depot, Herald's Lodge, Bard's House (bandstand), Artisan's Workshop + stall, Council Hall banners and clock. Family items got split between the lower-left cottage and the bottom-middle cottage.
    - Door check (Harm's rule: clear path to every front door, nothing in front of a door): blocked = depot (cart wheel), counting house (crate on steps), crier's press (paper stacks), workshop (workbench), family cottage lower-left (flower beds), post house (letter chest tight against door). No door at all = the two tall tile houses left and right of the square (fronts still hidden).
  - Door fix: Harm chose **option A** (remove the two hidden tall houses left and right of the square, leaving 11 houses: 9 agents + 2 spare guest houses) and **Nano Banana Pro** for precise edits. One 2K edit also moved the 6 blocking objects aside and asked for a clear path from every door. **160 credits**. Waiting for Harm's upload to check it.
- **Rule (Harm, 2026-10-31):** Every house must have a clear path to its front door. Nothing may sit in front of a door; trees or objects blocking a path get removed. People must be able to walk in and out of every house.

## Open questions

- Future art downloads: allow `cms-toolkit-artifacts.artlist.io` in the environment's network settings, or Harm uploads files in chat.
- Price per Artlist credit: work it out from the plan price (monthly price ÷ 16,500), or use a fixed number from Harm?
