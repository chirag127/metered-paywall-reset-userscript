---
type: Script
title: Metered Paywall Reset
description: Reads the full article behind a metered paywall from the page's own JSON-LD articleBody, the public AMP copy, or a public archive, and resets the local meter counter.
repo: https://github.com/chirag127/metered-paywall-reset-userscript
install: https://github.com/chirag127/metered-paywall-reset-userscript/raw/main/metered-paywall-reset-userscript.user.js
version: "1.0.0"
tags: [userscript, paywall, reader, news, json-ld, amp, archive]
timestamp: 2026-11-09T00:00:00Z
---

# Metered Paywall Reset

A browser-side reader for metered paywalls. It never calls a publisher API and never
proxies the page through a server; it reads copies the publisher already ships publicly
and resets the local counter.

## Method

| Source | Call |
|--------|------|
| JSON-LD | `script[type="application/ld+json"]` → first `Article`/`NewsArticle`/`BlogPosting` with `articleBody` > 200 chars |
| AMP | same-origin `fetch()` of `?amp`, `/amp`, `?outputType=amp`; body from JSON-LD or `[itemprop=articleBody]`, `.article-body`, `article`, … |
| Archive | open `https://archive.ph/newest/<url>` and `https://web.archive.org/web/2026/<url>` |
| Reset | delete cookies matching `paywall|meter|regwall|piano|tinypass|poool|subscri|article-count|views|visited|premium|gate|wall` + matching `localStorage`/`sessionStorage` |

The reader is a **local overlay**. The original document is left intact; closing the
overlay restores the page. `@grant none`.

## Limitations

- **HttpOnly cookies are invisible to JS**, so some counters cannot be cleared from the
  page. The aggressive "clear all site data" button covers what JS can reach.
- Many publishers dropped `articleBody` from JSON-LD; those pages need AMP or an archive.
- AMP copies can be truncated. Archive snapshots can be stale or missing for new articles.
- The broad `@match *://*/*` is intentional; the UI only appears on article-looking pages
  and via the `Alt+P` hotkey.

## Risk

Read-only and local by default. "Reset meter" changes site cookies/storage for the
current origin and reloads. "Clear all site data" is aggressive and can log you out.
