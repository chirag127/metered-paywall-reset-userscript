# AGENTS.md - metered-paywall-reset-userscript

Single-file userscript. `metered-paywall-reset-userscript.user.js` at repo root IS the
product. No build, no deps, `@grant none`.

## Method (best method - do not revert to overlay-clicking)

| Step | Source |
|------|--------|
| Read | `script[type="application/ld+json"]` → first `Article`/`NewsArticle`/`BlogPosting` node with `articleBody` > 200 chars |
| AMP | same-origin `fetch()` of `?amp`, `/amp`, `?outputType=amp`; extract JSON-LD or common article selectors |
| Archive | open `https://archive.ph/newest/<url>` and `https://web.archive.org/web/2026/<url>` |
| Reset | delete paywall-named cookies (JS-visible only) + matching localStorage/sessionStorage keys, then reload |

The reader is a **local overlay**: the original page is left untouched. Never rewrite
`document.body` — publishers' scripts break and the user loses the original.

## Rules

- One file, zero deps, `@grant none`. Bump `@version`; keep `@updateURL`/`@downloadURL` on raw `main`.
- Broad `@match *://*/*` is intentional (this is a general news tool). Gate the UI behind an
  article check + the `Alt+P` hotkey; do not show a panel on every page.
- HttpOnly cookies cannot be read or deleted from JS — say so in the README instead of pretending the reset is total.
- Guard every global hotkey with `isTyping()`.
- Do not add a server, a proxy, or a publisher API call. The whole point is that the page already has the text.

## Install docs

Shared guide: https://github.com/chirag127/userscript-install-guide — link it, never duplicate install steps.

## Test

`sctl install ./metered-paywall-reset-userscript.user.js`, open a news article, press
`Alt+P`, click **1 · Read articleBody** and confirm the reader shows the text. Then try
**2 · AMP** and **3 · Archive fallback**. Check `sctl debug console --level error` for
errors.

<!-- okf-requirement -->
## 🧠 OKF documentation requirement (mandatory)

**Every repository in this collection MUST ship an Open Knowledge Format (OKF) bundle in `okf/`.**

A repository without `okf/` is **incomplete**, even if the script works.

### What must exist

```
okf/
├── bundle.md      overview of the collection
├── index.md       catalogue of concepts
├── concepts/      all shared concept notes (architecture, metadata, scriptcat-and-sctl,
│                  testing, youtube-dom, okf-requirement)
└── scripts/       THIS repository's own script note (where one applies)
```

### Rules

1. **Never hand-edit** a repository's `okf/` copy. The canonical bundle is
   `repos/own/public/userscripts/okf/` in the `c:\ws` monorepo.
2. After changing the canonical bundle, regenerate every copy:
   `node okf/sync-okf.mjs`
3. Verify nothing has drifted: `node okf/sync-okf.mjs --check` - must exit `0`.
4. `README.md` must link to `okf/`. `AGENTS.md` (this file) must restate this requirement.
5. When adding a new script, add its note at `okf/scripts/<repo-name>.md` in the canonical
   bundle first, then sync.
6. Record durable knowledge here as a concept note: fragile selectors, platform rules,
   rejected alternatives, and mistakes that already cost time.

Full detail: [`okf/concepts/okf-requirement.md`](okf/concepts/okf-requirement.md)
