# News At Noire — site update (14 Oct 2026)

Upload everything in this folder to the root of `1CLovesTheHublol/newsatnoire` (branch `main`), keeping the folder structure.
On GitHub: **Add file → Upload files**, drag in the contents of this folder (not the folder itself), commit.

## Also delete in the repo
- `Public/news-at-noire-og.png.png` (duplicate of `news-at-noire-og.png`, double extension)

## What changed
- **index.html** — new front page: masthead, In This Issue, lead essay, Research Library feature, Front Page Essays, Sections.
- **closed-exit.html** (new) — reader for *The Closed Exit* with narration player and read-along highlighting.
- **All pages** — one shared header, mobile menu and footer (`assets/noire-shell.js` + `.css`), Libre Caslon / Source Serif type, favicon, meta description, canonical and social tags.
- **library.html** — The Closed Exit listed; placeholder cards removed.
- **article.html** — typo fix ("conform").
- **admin/config.yml** — new "Research Library → The Closed Exit — Narration" entry for uploading the MP3; essays get Section and Draft fields.
- **write.html, essays.html, essay.html** (new) — invite-only Writers' Desk, essays list and essay pages. Needs the worker update: see `WRITERS-DESK-SETUP.md`.
- **worker-oauth.js** — NOT for the repo. Paste it into the Cloudflare worker (setup guide step 5). Delete it from the folder before uploading if you like.

## Adding the narration
1. Go to `/admin` → Research Library → The Closed Exit — Narration → upload the MP3 → Publish.
2. Optional, for tighter highlighting: open `closed-exit.html?editor`, press play, turn on **Sync**, click the sentence you hear at a few points through the recording, click **Copy pins**, paste into the "Sync pins" field in `/admin`, publish.
