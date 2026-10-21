/* Daily Brief — reader dialog. This embeds publisher pages when permitted.
   It does not copy or republish copyrighted article text. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const dialog = $("articleReader");
  const frame = $("readerFrame");
  const close = $("readerClose");
  const source = $("readerSource");
  const title = $("readerTitle");
  const summary = $("readerSummary");
  const original = $("readerOriginal");
  const busy = $("readerLoading");
  const deniedNote = $("readerBlockedHint");
  const status = $("readerFrameStatus");
  let token = 0, timer = null;
  let savedFocus = null;

  function safeUrl(input) {
    try {
      const u = new URL(input);
      return (u.protocol === "https:" || u.protocol === "http:") ? u.toString() : null;
    } catch { return null; }
  }
  function setStatus(value) {
    status.textContent = value;
  }
  function cleanFrame() {
    token++;
    clearTimeout(timer);
    frame.removeAttribute("src");
    frame.title = "ニュース記事の埋め込み";
    busy.hidden = true;
    deniedNote.hidden = false;
    setStatus("");
  }
  function closeReader() {
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener("close", () => {
    cleanFrame();
    if(savedFocus && savedFocus.isConnected) savedFocus.focus({preventScroll:true});
    savedFocus = null;
  });
  close.addEventListener("click",closeReader);
  dialog.addEventListener("click", e => {
    if(e.target === dialog) closeReader();
  });
  frame.addEventListener("load", () => {
    // Browsers may report load even when the site's X-Frame-Options or CSP blocked it.
    // Therefore do not claim successful rendering based on this event.
    busy.hidden = true;
    setStatus("配信元の埋め込み制限により本文が表示されない場合があります。");
  });
  frame.addEventListener("error", () => {
    busy.hidden = true;
    setStatus("埋め込み表示に失敗しました。下の「配信元で読む」をお使いください。");
  });

  function open(article) {
    if (!article) return false;
    const url = safeUrl(article.url);
    if (!url || article.is_demo) return false;
    if(dialog.open) dialog.close();
    cleanFrame();
    savedFocus = document.activeElement;
    source.textContent = article.source || "配信元の記事";
    title.textContent = article.title || "ニュース記事";
    const excerpt = (article.summary || "").trim();
    summary.textContent = excerpt || "この記事には配信元RSSの説明文がありません。本文の閲覧可否は配信元サイトの設定によって異なります。";
    original.href = url;
    original.rel = "noopener noreferrer";
    original.target = "_blank";
    frame.title = "配信元の記事: " + (article.title || "ニュース");
    // Do not request the remote page until a user explicitly clicks to read.
    dialog.showModal();
    busy.hidden = false;
    deniedNote.hidden = false;
    setStatus("配信元ページを読み込んでいます…");
    const current = token;
    frame.src = url;
    timer = setTimeout(() => {
      if(current === token && dialog.open) {
        busy.hidden = true;
        setStatus("配信元の埋め込み制限や通信状況によっては表示できません。下のリンクから原文を確認できます。");
      }
    }, 9500);
    return true;
  }

  window.DailyBriefReader = {open,close:closeReader};
})();
