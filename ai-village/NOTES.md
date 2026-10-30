# My AI Village — Decision Notes

Running log of every decision made during the build. Newest entries at the bottom.

## Ground rules (2026-10-30)

- **Roles:** Harm is the director and says what he wants in plain words. Claude builds it.
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
