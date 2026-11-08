# 🔓 Metered Paywall Reset

Read the full text behind a **metered paywall** without an account: pull the
`articleBody` the publisher already ships in JSON-LD, fall back to the public **AMP**
copy, or hand off to a **public archive** — and reset the local meter cookie so the
counter starts over. No login, no server, no build.

> Metered paywalls count how many articles you read in a cookie / localStorage. The
> article is usually still in the HTML for search engines. This script reads that copy
> locally and shows it in a clean reader. It does not call a publisher API and does not
> send the page anywhere.

## Install

First read the shared **[userscript install guide](https://github.com/chirag127/userscript-install-guide)**
(how to set up ScriptCat / Tampermonkey). Then click:

**[Install metered-paywall-reset-userscript.user.js](https://github.com/chirag127/metered-paywall-reset-userscript/raw/main/metered-paywall-reset-userscript.user.js)**

## Use

Open any news article. A 🔓 chip appears bottom-right (or press **Alt+P**).

| Button | What it does |
|--------|--------------|
| **1 · Read articleBody** | Parses the page's `application/ld+json` and opens a clean reader with the full `articleBody` text. |
| **2 · AMP** | Tries the same-origin AMP copies (`?amp`, `/amp`, `?outputType=amp`) and reads their body; falls back to opening the `amp.` host. |
| **3 · Archive fallback** | Opens `archive.ph/newest/…` and the Wayback Machine for the current URL. |
| **Reset meter** | Deletes paywall/meter cookies and storage keys for this site, then reloads. |
| **Clear all site data** | Aggressive reset: every cookie and storage key for this origin. Use only if the targeted reset missed. |

The reader lets you **Copy**, **Download .txt**, or jump back to the **Original**.

## Method

| Source | How it is read |
|--------|----------------|
| JSON-LD | `script[type="application/ld+json"]` → any `Article` / `NewsArticle` / `BlogPosting` node with an `articleBody` > 200 chars |
| AMP | `fetch()` of same-origin `?amp`, `/amp`, `?outputType=amp`; body extracted from JSON-LD or common article selectors |
| Archive | Opens `archive.ph` + `web.archive.org` (public snapshots) in new tabs |
| Meter reset | Deletes cookies whose name matches `paywall|meter|regwall|piano|tinypass|poool|subscri|article-count|views|visited|premium|gate|wall`, plus matching `localStorage` / `sessionStorage` keys |

`@grant none` — everything runs with the page's own origin.

## Limitations

- **HttpOnly cookies** are invisible to JavaScript, so a few publishers' counters cannot be cleared from the page. Use the site's own "clear cookies" or the aggressive reset.
- Many publishers removed `articleBody` from JSON-LD (it was an SEO convenience). Those pages fall back to AMP or an archive.
- AMP pages may be partial or truncated; the reader shows exactly what the copy contains.
- Archive snapshots can be stale or missing for brand-new articles.
- This is a reader convenience, not a licence to redistribute. Respect each publisher's terms.

## License

[MIT](LICENSE) © 2026 chirag127

<!-- okf-bundle -->
## 🧠 Knowledge bundle (OKF)

This repository ships its documentation as an
**Open Knowledge Format** bundle in `okf/` —
written so both a human and an AI agent can understand the script without reading the code.

| File | Contents |
|------|----------|
| `okf/bundle.md` | Overview of the collection |
| `okf/index.md` | Catalogue of concepts |
| `okf/concepts/` | Shared knowledge (architecture, metadata, testing, DOM notes) |
| `okf/scripts/` | This script's own note (where applicable) |

Regenerate every repository's copy from the canonical bundle with `node okf/sync-okf.mjs`.
