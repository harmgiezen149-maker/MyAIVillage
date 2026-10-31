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

## House interiors — rules (Harm, 2026-10-31)

One Artlist image per house. Every room:
- **Scale:** a standing person is 1/12 of the image height. Furniture drawn that small, with open floor between pieces.
- **Layout:** the room fills the whole image. Back wall = thin strip at the top. One door, centered in a thin wall at the bottom.
- **Quality:** looks expensive, like a hundred-thousand-dollar fit-out. Nothing shabby.
- **No people** in the art; characters are added on top later.
- **Job:** each room obviously belongs to its job, with **one desk and chair** where its owner sits.
- **Process:** low-resolution drafts first, shown to Harm before spending on full-quality versions.

## World rules (Harm)

- **Always daytime (2026-10-31):** It is always daytime in the village. No night, no sleeping. People are always up and out.

## Walkable village page (2026-10-31)

- Private page (only Harm can see it): https://claude.ai/artifact/6w8CwvAmosjzt8C26LowVc
- `index.html` + `game/` (plain HTML/JavaScript, no keys, no outside servers, nothing loaded from the internet). Web-size art in `assets/` (map 3600 × 2688, rooms 2400 × 1792, props); full-size originals stay in `art/`.
- Walk with arrow keys / WASD or click; mouse wheel or +/− to zoom. Walk into a door to enter; walk out through the bottom door. All 12 doors and every room exit tested reachable (`tools/check_reachable.js`). `?debug` shows walk areas, obstacles and doors.
- Effects drawn in code (stay sharp when zoomed): chimney smoke (7 chimneys), fire only in the Council Hall and Family Cottage fireplaces plus the beacon brazier, fountain water, waving banners/flag/washing line, lamp and candle glow, glowing crystal orbs (the medieval "screens") and jukebox lights, drifting leaves. No ponds in the art, so no pond water.
- Props placed in yards and around the square, off paths and doors. The 2 extra council chairs stand at the foot of the table (12 in total), toned to match.
- The CEO is a simple drawn placeholder figure until the real characters arrive. Person height indoors = 1/12 of the room.
- Sound: soft breeze, the odd bird, and a swing tune from the jukebox that fades in as the CEO walks close; quieter indoors. Starts after the first click (browser rule). Made in code for now.
- Artlist sound: Harm upgraded the plan so sound downloads work (no watermark). Picked: "Morning birds chirping in a village" (re:focus), "Single Bird, Chirping" (InspectorJ), "Single Bird, Singing" (Marcello Del Monaco), and jukebox track "Learn How to Walk" (Ziv Grinberg). Downloads blocked: first by the workspace network, and after Harm allowed the hosts (2026-10-31) the Artlist file server itself refuses downloads from the workspace (403). Harm to download and upload the 4 files. The page uses them automatically once saved as `assets/sound/village-birds.aac`, `bird-chirp.aac`, `bird-song.aac`, `jukebox.mp3`.

## Walk & cover layers + paint mode (2026-10-31)

- Problem (Harm): the character walked on top of trees and tables, stood on a cottage window, and paths that continue behind objects were blocked.
- Fix (approved by Harm): three invisible layers per place on a 4 × 4 unit grid, stored in `game/masks.js`:
  - **Walk**: walkable or blocked.
  - **Under** (blue): always drawn over the character (tree tops, roofs, awnings).
  - **Behind** (yellow): drawn over the character only while his feet are above that patch's bottom edge, so he walks behind it above the line and in front of it below.
- The character is drawn with the covered parts cut away (soft edges), so the art shows through.
- First pass made by `tools/make_masks.js` from the shapes in `game/world.js`: buildings block; small things (picnic table, signpost, carts, garden boxes, notice board, market stall...) block only at their foot and cover the rest; two tree tops over paths are walkable and covering; room furniture blocks its lower half and covers the whole piece. Known roughness: covers are rectangles, so the character can vanish in empty space next to big furniture until painted.
- **Paint mode**: key E or the Edit map button. Tools 1–5 (Walkable, Blocked, Under, Behind, No cover), brush size, undo, reset place, Save. Shift- or right-drag looks around. Saves go to the page's own storage (`masks/<place>`, owner-only writing); Claude reads them and folds them into `game/masks.js`.
- Tested: all 12 doors and every room exit reachable; painting, undo and saving work.

## Characters (rules from Harm, 2026-10-31)

- **Harm is the Chief Human Officer** and is in charge. His character is made from his own photos, in the village style. (Earlier notes call the walking figure "the CEO"; that is this character.)
- **Every character gets a walking character sheet** made with Artlist:
  - A grid of **4 rows × 3 columns**, every frame the same size, on a plain background.
  - Row 1: walking toward the camera. Row 2: walking to the right. Row 3: walking to the left. Row 4: walking away (we see their back).
  - The 3 frames in each row: left foot forward, standing, right foot forward.
  - Big, obvious stride: legs clearly different in each frame and arms swinging, so they don't look like they're gliding.
  - Same person, same outfit, same size in all 12 frames.
- **Harm's look (2026-10-31):** tough biker. Red-and-black checkered flannel over a black T-shirt, sleeves rolled up; left arm a full tattoo sleeve, right arm bare with leather and silver bracelets; slightly ripped faded jeans; brown leather cowboy boots; small gold collar pin (in charge). Face, slicked-back hair and grey-streaked beard from his 3 photos (uploaded to his Artlist account with his yes).
- **Harm's sheet v1:** Nano Banana Pro, 2K, 3:4, photos + Crier's Press as style reference. **160 credits.** Saved as `art/characters/harm-sheet-v1.png` (1792 × 2400). Check: grid, magenta background, likeness, outfit, tattoo side all right. Problems: rows 1 (toward) and 4 (away) have a tiny stride, almost gliding; the middle "standing" frame of rows 2 and 3 faces the camera instead of right/left.
- **Harm's sheet v2 (fix edit):** Nano Banana Pro edit of v1, **160 credits** (approved by Harm). Saved as `art/characters/harm-sheet-v2.png`. Result: almost unchanged; rows 1 and 4 still barely step, the middle side frames still turn toward the camera.
- **Pose guide:** `tools/make_pose_template.py` draws a plain mannequin in all 12 walking poses (`art/characters/pose-template.png`) for Artlist to copy. Free.
- **Harm's sheet v3 (with pose guide):** Nano Banana Pro, pose guide + 3 photos + sheet v1 as references, **160 credits** (approved by Harm). Saved as `art/characters/harm-sheet-v3.png`. Result: a near copy of v1 — it followed the v1 sheet instead of the pose guide. Lesson: don't include an old sheet of the same character as a reference when the poses must change.
- **Harm's sheet v4 (used):** Nano Banana Pro with ONLY the pose guide + 3 photos (outfit in words), **160 credits** (approved by Harm). Saved as `art/characters/harm-sheet-v4.png`. Result: poses follow the guide (true side profiles, clear strides). Flaws fixed for free in code: the background wasn't one flat colour (each frame keyed on its own corner colour), and the first walking-away frame faced the camera (replaced by a mirror of the third back frame, so the tattoo flips to the other arm in that one frame).
- Cut-out and packing: `tools/cut_character.py` → `art/characters/harm-walk.png` (12 frames of 192 × 256, shared foot line and scale). In the game: walks with frames left-standing-right-standing, faces the way he moves, stands still on the middle frame; drawn with the walk/cover layers.
- **Size (Harm, 2026-10-31):** character made twice as large in town (92 map units tall instead of 46). Indoors stays 1/12 of the room height (the room rule).
- Character sheet cost so far: 4 attempts, **640 credits**.
- **Rule update (proposed by Claude):** every character sheet also gets the pose guide as a reference. When a new character is made from an existing sheet, use the pose guide plus that sheet, never an older sheet of the same character.
- **Every character after the first** is made by giving Artlist an existing character sheet as the reference and asking it to redraw it as a DIFFERENT person in the same style, same proportions and same grid. Never from words alone, or the proportions won't match the rest of the cast.

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
- **Claude usage:** start 26% of plan (reported by Harm, logged 09:40 UTC) / end _open_
- **Built:**
  - Job-themed town map: one 2K edit of the 4:3 map giving every building its agent's look (see "Agents and their buildings"). Nano Banana 2, **130 credits**. Balance after: 23,480.
    - Uploaded by Harm, saved as `art/maps/town-jobs-4x3.png` (2400 × 1792).
    - The edit added buildings: now 13 houses + town hall + a separate teal market stall (was 10 houses). New plain tile house far top-left; new carrier's depot bottom-left; artisan's workshop is a new house far right.
    - Job looks that came out right: Post House, Crier's Press (glowing orb), Scholar's Tower (telescope), Counting House (gilded disc), Carrier's Depot, Herald's Lodge, Bard's House (bandstand), Artisan's Workshop + stall, Council Hall banners and clock. Family items got split between the lower-left cottage and the bottom-middle cottage.
    - Door check (Harm's rule: clear path to every front door, nothing in front of a door): blocked = depot (cart wheel), counting house (crate on steps), crier's press (paper stacks), workshop (workbench), family cottage lower-left (flower beds), post house (letter chest tight against door). No door at all = the two tall tile houses left and right of the square (fronts still hidden).
  - Door fix: Harm chose **option A** (remove the two hidden tall houses left and right of the square, leaving 11 houses: 9 agents + 2 spare guest houses) and **Nano Banana Pro** for precise edits. One 2K edit also moved the 6 blocking objects aside and asked for a clear path from every door. **160 credits**. Harm's screenshot of the right side showed: workbench moved ✓, but a row of trees blocked the workshop's path to the square, paper stacks still in front of the press doors, and the right tall house still there.
  - Second fix (Harm: "remove 2 trees"): Nano Banana Pro edit removing the top two trees in the row between the workshop and the press (replaced with a dirt path), plus moving the paper stacks and removing the right tall house (both part of the already-approved option A). **160 credits**. Uploaded by Harm, saved as `art/maps/town-jobs-4x3-v3.png` (2400 × 1792).
    - Check: tree row removed, workshop now has a clear dirt path ✓; workbench moved aside ✓. Still wrong: both tall tile houses left and right of the square are still there (the edit ignored the removal twice), and the paper stacks still sit next to the press doors.
  - Interior drafts: 10 rooms (Council Hall, Post House, Counting House, Scholar's Tower, Artisan's Workshop, Family Cottage, Bard's House, Crier's Press, Herald's Lodge, Carrier's Depot). Style guide + interior rules in every prompt, 4:3. Nano Banana 2 Lite, 1K. 50 credits each, **500 credits total** (approved by Harm). Guest houses skipped for now.
    - Harm uploaded all 10 drafts (zip) and approved them ("these look great"). Saved as `art/interiors/drafts/<room>.jpg` (1200 × 896).
    - Check against the room rules: job themes and luxury ✓, no people ✓, one desk + chair ✓. Drift: walls are tall dollhouse walls rather than thin strips; several rooms float on a dark background instead of filling the image; furniture is larger than the 1/12-person scale; the Artisan's Workshop is a corner view with **no door**.
- **Town hall interior changed (Harm, 2026-10-31):** one big table with 12 chairs, one chair at the head of the table for Harm. Replaces the map table + desk design.
- **4K interiors (2026-10-31):** Harm chose to fix the rule drift in the 4K pass. 9 rooms redrawn at 4K from their drafts (Nano Banana 2, 200 each) with full-image floor, thin walls, centered bottom door (door added to the Workshop) and smaller furniture; plus a new Council Hall draft (Nano Banana 2 Lite, 50): marble floor and nine banners kept, one long table with 12 chairs (Harm's carved chair at the head nearest the back wall, 5 per side, 1 at the far end; chief of staff sits at Harm's right hand). Batch total **1,850 credits** (approved by Harm).
    - Harm uploaded all 9 rooms (4800 × 3584) and the Council Hall draft. Saved as `art/interiors/<room>.png` and `art/interiors/drafts/council-hall-12-chairs.jpg`.
    - Check: 7 rooms share the same front-facing three-quarter angle with a centered bottom door. Off-angle: **Crier's Press** (flat straight-down view) and **Artisan's Workshop** (still a diagonal corner view; door on the left, not centered). Family Cottage and Carrier's Depot still show a bit of outdoor stone below the door. Walls are still taller than "thin strips" in most rooms. Council Hall draft: about 11 chairs counted (1 head, 5 left, 4 right, 1 end), not 12.
    - Harm: redo the room that isn't angled like the rest, and make the Council Hall in 4K.
    - Harm chose **option A**: redo the **Crier's Press** (Harm's "number 7") at 4K, using the Scholar's Tower as the angle reference, plus the **Council Hall at 4K** with exactly 12 chairs spelled out (1 head, 5 per side, 1 end). **400 credits** (approved by Harm). Artisan's Workshop stays as is for now (still a corner view).
    - Uploaded by Harm and saved over `art/interiors/criers-press.png` and as `art/interiors/council-hall.png` (both 4800 × 3584).
    - Crier's Press: angle now matches the other rooms ✓, door centered ✓. Side effect: its desk copied the Scholar's desk (open books, magnifying glass).
    - Council Hall: chairs counted again = **11** (1 head, 5 left, 4 right, 1 end), not 12. View is diagonal rather than front-facing, and the door stands on the floor instead of sitting in the bottom wall.
- **Harm likes the crisp, clean look of the 4K rooms** and wants the whole village map redrawn in that style with the updated buildings.
  - Village redraw: Nano Banana Pro, 4K, 4:3, with the latest map as the layout reference and the new Crier's Press as the style reference. Same prompt retried removing the two hidden tall houses, moving the paper stacks and keeping every door clear. **280 credits** (approved by Harm, option A).
  - Council Hall chair fix: Nano Banana 2, 4K, with the Scholar's Tower as the angle reference; prompt spells out 1 + 5 + 5 + 1 = 12 chairs and the door set into the bottom wall. **200 credits** (approved by Harm).
  - Uploaded by Harm. Saved as `art/maps/town-crisp-4x3.png` and over `art/interiors/council-hall.png` (both 4800 × 3584).
    - Village map: nearly identical to the previous map, only slightly sharper; still close to pixel art. The two tall houses next to the square are **still there** (third failed removal) and the paper stacks still sit by the press doors. Decision pending: keep those two houses closed in the game instead of retrying.
    - Council Hall: now front-facing ✓, door in the bottom wall ✓, but chairs counted = **10** (1 head, 4 left, 4 right, 1 end), and the banners show 8 colors (silver missing).
- **Props (Harm, 2026-10-31):** a sheet of small separate props (benches, street lamps, barrels, crates, flower beds, bushes, fences, the fountain, and a vintage jukebox playing with music notes coming out), same style guide, placed around town so it feels lived in, paths kept clear.
  - Prop sheet made: ~20 props in a grid on a flat magenta background (for cutting out): 2 benches, 2 street lamps, fountain, 3 barrels, 3 crates, 2 flower beds, 3 bushes, 2 fence pieces, **2 extra carved council chairs** (to bring the Council Hall to 12 in the game), and the playing jukebox with music notes. Style guide word for word, crisp map + Council Hall as style references, no edge blur on this sheet. Nano Banana 2, 4K. **200 credits** (approved by Harm).
  - Network access updated by Harm (2026-10-31): Artlist downloads now work from the workspace. Prop sheet downloaded to `art/props/prop-sheet.png` (4800 × 3584).
    - Check: all requested props present ✓ (2 benches, 2 lamps, fountain, 3 barrels, 3 crates, 2 flower beds, 3 bushes, straight + corner fence, 2 council chairs, jukebox with golden music notes ✓). Problem: the Council Hall style reference bled into the sheet — a faded council table, chairs, marble floor and door sit behind the middle and bottom props, plus an unrequested chandelier. Props on the clean magenta edges can be cut out; the 2 council chairs, corner fence, second flower bed, first bush, large crate and third barrel sit on top of the ghost room.
  - Cleanup edit (option A, approved by Harm): Nano Banana Pro 4K. First attempt failed on Artlist's side (no credits used); second attempt **280 credits**. Saved as `art/props/prop-sheet-clean.png`. Result only partly clean: the doorway and chandelier are gone, but a faded table and chairs still sit in the middle.
  - Cut-outs made in the workspace (free) with `tools/cut_props.py` (magenta key + removing loose scraps), saved as transparent PNGs in `art/props/`: bench-plain, bench-iron, lamp-hanging, lamp-post, fountain, barrel, barrel-lid, crate-large, crate-small, crate-stack, flowerbed-a, bush-medium, bush-small, fence-straight, fence-corner, council-chair-a, council-chair-b, jukebox (with its music notes). **18 clean props.**
  - Still carrying bits of the faded room, parked in `art/props/needs-fix/`: barrel-small, bush-large, flowerbed-b. Clean look-alikes exist for each, so they are optional.
  - Placement plan: props get cut out and placed **in code** on the walkable page (never on paths or in front of doors), not painted into the map by AI. The two hidden tall houses next to the square stay closed in the game.
- **Rule (Harm, 2026-10-31):** Every house must have a clear path to its front door. Nothing may sit in front of a door; trees or objects blocking a path get removed. People must be able to walk in and out of every house.

## Open questions

- Future art downloads: allow `cms-toolkit-artifacts.artlist.io` in the environment's network settings, or Harm uploads files in chat.
- Price per Artlist credit: work it out from the plan price (monthly price ÷ 16,500), or use a fixed number from Harm?
