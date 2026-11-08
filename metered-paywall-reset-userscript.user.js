// ==UserScript==
// @name         Metered Paywall Reset
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Read the full text behind a metered paywall from the page's own JSON-LD articleBody, the AMP copy, or a public archive — and reset the meter cookie. No login, no server, no build.
// @author       chirag127
// @license      MIT
// @match        *://*/*
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E%F0%9F%94%93%3C/text%3E%3C/svg%3E
// @homepageURL  https://github.com/chirag127/metered-paywall-reset-userscript
// @supportURL   https://github.com/chirag127/metered-paywall-reset-userscript/issues
// @downloadURL  https://github.com/chirag127/metered-paywall-reset-userscript/raw/main/metered-paywall-reset-userscript.user.js
// @updateURL    https://github.com/chirag127/metered-paywall-reset-userscript/raw/main/metered-paywall-reset-userscript.user.js
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Metered paywalls hand the article to the browser twice: once inside
   * the JSON-LD block that publishers ship for search engines (articleBody),
   * and again on the public AMP copy. This tool reads those copies, opens a
   * clean reader overlay, and can reset the local meter counter. It never
   * calls a publisher API and never sends the page anywhere.
   * ------------------------------------------------------------------ */

  const ARTICLE_TYPES = /(NewsArticle|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle|BlogPosting|Article)/i;
  const PAYWALL_RE = /(paywall|meter|regwall|piano|tinypass|poool|subscri|article.?count|article.?view|views?|visited|premium|gate|p13n|wall)/i;
  const BODY_SELECTORS = [
    '[itemprop="articleBody"]',
    ".article-body", ".article__body", ".articleBody", ".story-body",
    ".post-content", ".entry-content", ".c-entry-content", ".article-content",
    "#article-body", "#articleBody", "article",
  ];

  const state = { route: "", busy: false, article: null };

  /* ----------------------------- utils ----------------------------- */

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "style") Object.assign(n.style, v);
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return n;
  }

  const isTyping = () => {
    const a = document.activeElement;
    if (!a) return false;
    const t = (a.tagName || "").toUpperCase();
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || a.isContentEditable;
  };

  /* ---------------------- article extraction ----------------------- */

  function ldNodes(doc) {
    return [...doc.querySelectorAll('script[type="application/ld+json"]')];
  }

  function flatten(node) {
    if (Array.isArray(node)) return node.flatMap(flatten);
    if (node && node["@graph"]) return [node, ...flatten(node["@graph"])];
    return [node];
  }

  function findArticleLD(doc = document) {
    for (const n of ldNodes(doc)) {
      let data;
      try { data = JSON.parse(n.textContent); } catch { continue; }
      for (const item of flatten(data)) {
        if (!item || typeof item !== "object") continue;
        const types = [].concat(item["@type"] || []).join(" ");
        if (!ARTICLE_TYPES.test(types)) continue;
        const body = typeof item.articleBody === "string" ? item.articleBody.trim() : "";
        if (body.length > 200) {
          return {
            headline: item.headline || item.name || document.title,
            author: normAuthor(item.author),
            date: item.datePublished || item.dateModified || "",
            body,
            url: location.href,
          };
        }
      }
    }
    return null;
  }

  function normAuthor(a) {
    if (!a) return "";
    if (typeof a === "string") return a;
    if (Array.isArray(a)) return a.map(normAuthor).filter(Boolean).join(", ");
    return a.name || "";
  }

  function textFromDoc(doc) {
    const ld = findArticleLD(doc);
    if (ld) return ld;
    for (const sel of BODY_SELECTORS) {
      const node = doc.querySelector(sel);
      if (!node) continue;
      const text = (node.innerText || node.textContent || "").replace(/\s+\n/g, "\n").trim();
      if (text.length > 500) {
        return {
          headline: (doc.querySelector("h1") && doc.querySelector("h1").innerText) || doc.title,
          author: "",
          date: "",
          body: text,
          url: doc.location ? doc.location.href : location.href,
        };
      }
    }
    return null;
  }

  /* ------------------------- reader overlay ------------------------ */

  let overlay = null;

  function openReader(article, source) {
    closeReader();
    const body = String(article.body || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();

    const paras = body.includes("\n\n")
      ? body.split(/\n{2,}/)
      : body.split(/\n/).filter(Boolean);

    const stage = el("div", { class: "mpr-stage" });
    const head = el("div", { class: "mpr-read-head" },
      el("h1", { class: "mpr-h1", text: article.headline || "Article" }),
      el("div", { class: "mpr-meta" },
        el("span", null, source || "JSON-LD"),
        article.author ? el("span", null, " · " + article.author) : null,
        article.date ? el("span", null, " · " + String(article.date).slice(0, 10)) : null
      )
    );
    stage.append(head);

    const content = el("div", { class: "mpr-content" + (state.tight ? " mpr-tight" : "") });
    for (const p of paras) {
      const t = p.trim();
      if (t) content.append(el("p", null, t));
    }
    stage.append(content);

    const bar = el("div", { class: "mpr-read-bar" },
      el("span", { class: "mpr-spacer" }),
      el("button", { class: "mpr-btn", onclick: () => copyText(article.body) }, "Copy"),
      el("button", { class: "mpr-btn", onclick: () => downloadText(article) }, "Download .txt"),
      el("button", {
        class: "mpr-btn mpr-ghost",
        onclick: () => { location.href = article.url || location.href; },
      }, "Original"),
      el("button", { class: "mpr-btn mpr-ghost", onclick: closeReader }, "Close")
    );

    overlay = el("div", { class: "mpr-overlay", id: "mpr-overlay" },
      el("div", { class: "mpr-read" }, bar, stage)
    );
    document.body.append(overlay);
    document.addEventListener("keydown", readerKeys, true);
    if (ui) ui.log("Opened " + (source || "JSON-LD") + " reader (" + (article.body || "").length + " chars).");
  }

  function readerKeys(e) {
    if (e.key === "Escape") { e.preventDefault(); closeReader(); }
  }

  function closeReader() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", readerKeys, true);
  }

  function copyText(t) {
    navigator.clipboard.writeText(t).then(
      () => ui && ui.log("Copied " + t.length + " chars."),
      () => ui && ui.log("Clipboard blocked by the browser.", "bad")
    );
  }

  function downloadText(article) {
    const safe = (article.headline || "article").replace(/[^\w\d-]+/g, "-").slice(0, 60) || "article";
    const blob = new Blob([article.body || ""], { type: "text/plain;charset=utf-8" });
    const a = el("a", { href: URL.createObjectURL(blob), download: safe + ".txt" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ----------------------------- AMP ------------------------------- */

  async function ampCandidates() {
    const u = new URL(location.href);
    const path = u.pathname.replace(/\/+$/, "");
    const list = [];
    // Same-origin variants we can fetch.
    list.push(u.origin + path + (u.search ? u.search + "&amp=1" : "?amp=1"));
    list.push(u.origin + path + "/amp" + u.search);
    list.push(u.origin + path + "?outputType=amp");
    // Cross-origin host variant (opened, not fetched).
    const host = u.host.replace(/^www\./, "");
    if (!u.host.startsWith("amp.")) list.push(u.protocol + "//amp." + host + u.pathname + u.search);
    return [...new Set(list)];
  }

  async function readAmp() {
    if (state.busy) return;
    state.busy = true;
    ui && ui.log("Trying AMP copies…");
    try {
      for (const url of await ampCandidates()) {
        if (new URL(url).origin !== location.origin) continue; // cross-origin cannot be fetched
        try {
          const res = await fetch(url, { credentials: "omit" });
          if (!res.ok) continue;
          const html = await res.text();
          if (!/articleBody|article-body|articleBody/i.test(html) && html.length < 2000) continue;
          const doc = new DOMParser().parseFromString(html, "text/html");
          const art = textFromDoc(doc);
          if (art) {
            art.url = location.href;
            openReader(art, "AMP: " + new URL(url).pathname);
            return;
          }
        } catch (_) { /* next candidate */ }
      }
      ui && ui.log("No same-origin AMP copy answered. Opening the amp. host.", "warn");
      const hostVariant = (await ampCandidates()).find((x) => new URL(x).origin !== location.origin);
      if (hostVariant) window.open(hostVariant, "_blank", "noopener");
    } finally {
      state.busy = false;
    }
  }

  /* ---------------------------- archive ---------------------------- */

  function archiveLinks() {
    const url = location.href.split("#")[0];
    return [
      ["archive.today (newest)", "https://archive.ph/newest/" + url],
      ["Wayback Machine", "https://web.archive.org/web/2026/" + url],
      ["archive.today (search)", "https://archive.ph/https://" + location.host + location.pathname],
    ];
  }

  function openArchives() {
    for (const [, href] of archiveLinks()) window.open(href, "_blank", "noopener");
    ui && ui.log("Opened archive.today and the Wayback Machine in new tabs.");
  }

  /* --------------------------- meter reset ------------------------- */

  function cookieNames() {
    return document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter(Boolean);
  }

  function delCookie(name) {
    const paths = ["/", location.pathname, location.pathname.replace(/\/[^/]*$/, "/") || "/"];
    const domains = ["", location.hostname, "." + location.hostname.replace(/^www\./, "")];
    for (const path of [...new Set(paths)]) {
      for (const domain of [...new Set(domains)]) {
        document.cookie = name + "=; Max-Age=0; path=" + path + (domain ? "; domain=" + domain : "");
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=" + path + (domain ? "; domain=" + domain : "");
      }
    }
  }

  function clearStorage(re) {
    let n = 0;
    for (const store of [localStorage, sessionStorage]) {
      try {
        for (const k of Object.keys(store)) {
          if (re.test(k)) { store.removeItem(k); n++; }
        }
      } catch (_) { /* blocked */ }
    }
    return n;
  }

  function resetMeter(all) {
    const re = all ? /./ : PAYWALL_RE;
    let cookies = 0, keys = 0;
    for (const name of cookieNames()) {
      if (re.test(name)) { delCookie(name); cookies++; }
    }
    keys = clearStorage(re);
    ui && ui.log("Cleared " + cookies + " cookie(s) and " + keys + " storage key(s).", "good");
    ui && ui.log("Reloading…");
    setTimeout(() => location.reload(), 700);
  }

  /* ----------------------------- panel ----------------------------- */

  let ui = null;

  function log(msg, kind) {
    if (!ui) return;
    const line = el("div", { class: "mpr-log-line" + (kind ? " mpr-" + kind : "") },
      new Date().toLocaleTimeString() + "  " + msg);
    ui.logbox.prepend(line);
    while (ui.logbox.childElementCount > 40) ui.logbox.lastChild.remove();
  }

  function build() {
    if (document.getElementById("mpr-panel")) return;

    const panel = el("div", { id: "mpr-panel", class: "mpr-panel" },
      el("div", { class: "mpr-hdr" },
        el("span", { class: "mpr-dot" }),
        el("strong", null, "Paywall reset"),
        el("span", { class: "mpr-spacer" }),
        el("button", { class: "mpr-min", title: "Collapse", onclick: collapse }, "–"),
        el("button", { class: "mpr-x", title: "Hide", onclick: () => { panel.style.display = "none"; chip.style.display = "block"; } }, "×")
      ),
      el("div", { class: "mpr-body" },
        el("div", { class: "mpr-row" },
          el("button", { class: "mpr-btn", onclick: readLocalLD }, "1 · Read articleBody"),
          el("button", { class: "mpr-btn mpr-ghost", onclick: readAmp }, "2 · AMP")
        ),
        el("div", { class: "mpr-row" },
          el("button", { class: "mpr-btn mpr-ghost", onclick: openArchives }, "3 · Archive fallback")
        ),
        el("div", { class: "mpr-row" },
          el("button", { class: "mpr-btn mpr-ghost", onclick: () => resetMeter(false) }, "Reset meter"),
          el("button", { class: "mpr-btn mpr-ghost", onclick: () => resetMeter(true) }, "Clear all site data")
        ),
        el("div", { class: "mpr-status", id: "mpr-status" }, "—"),
        el("div", { class: "mpr-log", id: "mpr-log" })
      )
    );

    const chip = el("button", { id: "mpr-chip", class: "mpr-chip", title: "Metered paywall reset (Alt+P)" }, "🔓");

    document.body.append(panel, chip);
    chip.style.display = "block";

    ui = {
      panel, chip,
      status: panel.querySelector("#mpr-status"),
      logbox: panel.querySelector("#mpr-log"),
      log,
    };

    drag(panel.querySelector(".mpr-hdr"), panel);
    refreshStatus();
    panel.style.display = "none";
  }

  function collapse() {
    const panel = document.getElementById("mpr-panel");
    if (!panel) return;
    panel.classList.toggle("mpr-collapsed");
    const min = panel.querySelector(".mpr-min");
    if (min) min.textContent = panel.classList.contains("mpr-collapsed") ? "+" : "–";
  }

  function refreshStatus() {
    if (!ui) return;
    const ld = findArticleLD();
    const og = document.querySelector('meta[property="og:type"]');
    const looks = (og && /article/i.test(og.content || "")) || !!document.querySelector("article");
    let text;
    if (ld) text = "JSON-LD articleBody found · " + ld.body.length + " chars";
    else if (looks) text = "Article page · no articleBody in JSON-LD (try AMP or archive)";
    else text = "Not an article page — open a news story first";
    ui.status.textContent = text;
  }

  function readLocalLD() {
    const art = findArticleLD();
    if (!art) {
      ui && ui.log("No articleBody in this page's JSON-LD. Try AMP or an archive.", "warn");
      return;
    }
    art.url = location.href;
    openReader(art, "JSON-LD articleBody");
  }

  function drag(handle, box) {
    let on = false, sx = 0, sy = 0, ox = 0, oy = 0;
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      on = true; sx = e.clientX; sy = e.clientY;
      const r = box.getBoundingClientRect(); ox = r.left; oy = r.top;
      box.style.right = "auto"; box.style.bottom = "auto";
      box.style.left = ox + "px"; box.style.top = oy + "px";
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!on) return;
      box.style.left = Math.max(0, ox + e.clientX - sx) + "px";
      box.style.top = Math.max(0, oy + e.clientY - sy) + "px";
    });
    handle.addEventListener("pointerup", () => (on = false));
  }

  function togglePanel() {
    if (!ui) return;
    const p = ui.panel;
    if (p.style.display === "none") {
      p.style.display = "flex";
      ui.chip.style.display = "none";
      refreshStatus();
    } else {
      p.style.display = "none";
      ui.chip.style.display = "block";
    }
  }

  /* ----------------------------- boot ------------------------------ */

  function styleSheet() {
    return `
      #mpr-panel,#mpr-chip{font:12px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e8e8e8;background:#181818;border:1px solid #2c2c2c;border-radius:10px;box-shadow:0 12px 40px #000a;z-index:2147483000}
      #mpr-panel{position:fixed;right:18px;bottom:18px;width:340px;display:flex;flex-direction:column;overflow:hidden;resize:both}
      #mpr-panel.mpr-collapsed .mpr-body{display:none}
      .mpr-hdr{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#111;border-bottom:1px solid #2c2c2c;cursor:grab;user-select:none}
      .mpr-dot{width:8px;height:8px;border-radius:50%;background:#065fd4;box-shadow:0 0 0 3px #065fd433}
      .mpr-spacer{flex:1}
      .mpr-hdr button{background:none;border:0;color:#aaa;font-size:15px;cursor:pointer}
      .mpr-body{display:flex;flex-direction:column;gap:8px;padding:10px}
      .mpr-row{display:flex;gap:6px}
      .mpr-btn{flex:1;background:#065fd4;border:1px solid #065fd4;color:#fff;border-radius:6px;padding:6px 8px;font-size:11px;cursor:pointer}
      .mpr-ghost{background:#222;border-color:#333;color:#ddd}
      .mpr-btn:hover{filter:brightness(1.12)}
      .mpr-status{color:#9aa;font-size:11px;min-height:16px}
      .mpr-log{height:104px;overflow:auto;background:#101010;border:1px solid #262626;border-radius:6px;padding:5px;font:10px/1.5 ui-monospace,Consolas,monospace}
      .mpr-log-line{white-space:pre-wrap}
      .mpr-good{color:#5fd68a}.mpr-bad{color:#ff7b72}.mpr-warn{color:#f0b429}
      #mpr-chip{position:fixed;right:18px;bottom:18px;width:38px;height:38px;border-radius:999px;background:#181818;border:1px solid #065fd4;color:#fff;font-size:16px;cursor:pointer}
      #mpr-overlay{position:fixed;inset:0;z-index:2147483200;background:#0d0d0df2;backdrop-filter:blur(3px);display:flex;align-items:stretch;justify-content:center;padding:24px}
      .mpr-read{position:relative;display:flex;flex-direction:column;width:min(760px,94vw);background:#faf8f2;color:#1a1a1a;border-radius:12px;overflow:hidden;box-shadow:0 24px 80px #000c}
      .mpr-read-bar{display:flex;gap:6px;align-items:center;padding:8px 10px;background:#1a1a1a}
      .mpr-read-bar .mpr-btn{flex:0 0 auto;padding:5px 10px}
      .mpr-stage{overflow:auto;padding:28px 32px 40px}
      .mpr-h1{font:700 26px/1.25 Georgia,'Times New Roman',serif;margin:0 0 8px}
      .mpr-meta{color:#666;font-size:12px;margin-bottom:18px}
      .mpr-content{font:17px/1.65 Georgia,'Times New Roman',serif}
      .mpr-content p{margin:0 0 1em}
      .mpr-content.mpr-tight{font-size:15px;line-height:1.55}
    `;
  }

  function boot() {
    if (document.documentElement.dataset.mprBooted) return;
    document.documentElement.dataset.mprBooted = "1";
    document.head.append(el("style", null, styleSheet()));
    build();
    routeTick();
    new MutationObserver(() => {
      if (ui && !document.body.contains(ui.panel) && document.body) document.body.append(ui.panel, ui.chip);
    }).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(routeTick, 1000);

    document.addEventListener("keydown", (e) => {
      if (isTyping()) return;
      if (e.altKey && (e.key === "p" || e.key === "P")) { e.preventDefault(); togglePanel(); }
    }, true);
  }

  function routeTick() {
    if (location.href === state.route) return;
    state.route = location.href;
    if (!ui) build();
    refreshStatus();
    if (ui) {
      ui.panel.style.display = "none";
      ui.chip.style.display = "block";
    }
  }

  boot();
})();
