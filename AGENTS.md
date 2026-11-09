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
## 📚 Documentation lives in ONE place (mandatory)

All documentation for every repository in this workspace is **single-sourced** in the
umbrella repository:

```
c:\ws\docs\okf├── bundle.md            collection overview
├── index.md             catalogue of every concept and script note
├── concepts/            shared knowledge (architecture, testing, metadata, …)
└── scripts/             one note per userscript repository
```

### Rules

1. **Never create an `okf/` folder in this repository.** It is not duplicated here, by
   design. There was once a copy in every repo: 278 files describing 42 unique documents,
   with `concepts/architecture.md` physically present 32 times. Every edit had to be
   propagated to 30 repositories and drift was unavoidable.
2. **Never hand-edit a copy.** There are no copies. Edit the canonical file under
   `c:\ws\docs\okf\`.
3. **This repository's note is** `c:\ws\docs\okf\scripts\<repo-name>.md`. If it does not
   exist, add it before adding the script.
4. **Link, do not paste.** In `README.md`, link to the canonical note with a relative path
   from the workspace, e.g. `[documentation](../../../../../docs/okf/scripts/<repo-name>.md)`.
5. **Verify** with `node c:\ws\scripts\check-okf.mjs` — it exits `0` only when nothing is
   duplicated and every repository is linked and documented.
6. When adding a new script: create the repo, add `docs/okf/scripts/<repo-name>.md`, add it
   to the tables in `docs/okf/bundle.md` and `docs/okf/index.md`, then run the checker.

Full detail: `c:\ws\docs\okf\concepts\okf-requirement.md`.
