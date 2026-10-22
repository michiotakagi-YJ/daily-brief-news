/* ChatGPT daily news edition. Reads dated, public GitHub JSON; no paid API calls. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const panel = $("dailyEdition");
  if (!panel) return;
  const sectionsBox = $("digestSections"), status = $("digestStatus"), lead = $("digestLead");
  const count = $("digestCount"), dateInput = $("digestDate");
  const category = $("digestCategory"), rating = $("digestImportance"), query = $("digestSearch");
  const newestButton = $("digestLatest");
  const cache = new Map();
  let edition = null, activeDate = "", requestSerial = 0;
  function el(tag, cls, value) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = String(value);
    return n;
  }
  function isoJST(date = new Date()) {
    return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  }
  function pastDay(day, diff) {
    const t = new Date(day + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() - diff);
    return t.toISOString().slice(0, 10);
  }
  const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z"));
  function safeURL(s) {
    try {
      const u = new URL(s);
      if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
    } catch {}
    return null;
  }
  function importance(v) {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;
  }
  function stars(n) {return "★".repeat(n) + "☆".repeat(5 - n);}
  function readEdition(day) {
    if (!validDate(day)) return Promise.reject(new Error("Invalid date"));
    if (!cache.has(day)) {
      const promise = fetch("./data/editorial/" + encodeURIComponent(day) + ".json", {cache:"no-store"})
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(data => {
          if (!data || data.schema_version !== 1 || !Array.isArray(data.sections) || data.edition_date !== day)
            throw new Error("Invalid editorial edition");
          return data;
        }).catch(e => {cache.delete(day);throw e;});
      cache.set(day,promise);
    }
    return cache.get(day);
  }
  function setStatus(message, mode) {
    status.textContent = message;
    status.dataset.mode = mode || "info";
  }
  function categoryOptions() {
    const previous = category.value;
    category.replaceChildren(el("option",null,"すべての分野"));
    category.firstChild.value="all";
    if (edition) {
      for (const sec of edition.sections) {
        if (!sec || !Array.isArray(sec.items) || !sec.items.length) continue;
        const opt = el("option",null,sec.name||sec.id||"その他");
        opt.value = String(sec.id || sec.name || "other");
        category.append(opt);
      }
    }
    category.value=[...category.options].some(x=>x.value===previous)?previous:"all";
  }
  function sourceLinks(item) {
    const wrap = el("div","digest-source-links");
    const sources = Array.isArray(item.sources)?item.sources:[];
    for (const source of sources) {
      const url = safeURL(source && source.url);
      if (!url) continue;
      const a=el("a","digest-source",source.name||"出典を確認");
      a.href=url; a.target="_blank"; a.rel="noopener noreferrer";
      wrap.append(a);
    }
    return wrap;
  }
  function article(item,sectionId) {
    const row=el("article","digest-item");
    const header=el("button","digest-item-trigger");
    header.type="button";header.setAttribute("aria-expanded","false");
    const score=importance(item.importance);
    const meta=el("div","digest-item-meta");
    meta.append(el("span","digest-item-stars",stars(score)));
    const when=String(item.event_date||"").slice(0,10);
    if(validDate(when))meta.append(el("span","digest-item-date",when));
    const title=el("div","digest-item-title",item.title||"見出しなし");
    const synopsis=el("p","digest-item-summary",item.summary||"要旨未取得");
    const arrow=el("span","digest-item-arrow","＋");
    const left=el("div","digest-item-text");
    left.append(meta,title,synopsis);
    header.append(left,arrow);
    const detail=el("div","digest-item-detail");
    detail.hidden=true;
    if(item.context) {
      detail.append(el("strong","digest-detail-label","背景・経緯"));
      detail.append(el("p","digest-detail-text",item.context));
    }
    if(item.impact) {
      detail.append(el("strong","digest-detail-label","影響・今後の論点"));
      detail.append(el("p","digest-detail-text",item.impact));
    }
    const links=sourceLinks(item);
    if(links.children.length) {
      detail.append(el("strong","digest-detail-label","参考資料"));
      detail.append(links);
    }
    if(!detail.children.length)detail.append(el("p","digest-detail-text","追加の背景解説はありません。要旨と出典をご確認ください。"));
    header.addEventListener("click",()=>{
      const expanded=detail.hidden;
      detail.hidden=!expanded;
      header.setAttribute("aria-expanded",String(expanded));
      arrow.textContent=expanded?"−":"＋";
    });
    row.append(header,detail);
    return row;
  }
  function render() {
    sectionsBox.replaceChildren();
    if (!edition) {count.textContent="—";return;}
    let total=0, visible=0;
    const selectedCategory=category.value||"all";
    const minImportance=Number(rating.value||1);
    const search=query.value.trim().toLocaleLowerCase("ja-JP");
    const frag=document.createDocumentFragment();
    for (const sec of edition.sections) {
      if(!sec || !Array.isArray(sec.items))continue;
      total += sec.items.length;
      if(selectedCategory!=="all" && selectedCategory !== String(sec.id||sec.name||"other"))continue;
      const items=sec.items.filter(item=>{
        const value=importance(item.importance);
        if(value < minImportance)return false;
        const searchable=[item.title,item.summary,item.context,item.impact].join(" ").toLocaleLowerCase("ja-JP");
        return !search || searchable.includes(search);
      });
      if(!items.length)continue;
      visible+=items.length;
      const box=el("section","digest-group");
      const head=el("div","digest-group-head");
      const groupRating=importance(sec.importance);
      head.append(el("h3",null,sec.name||sec.id||"ニュース"));
      if(groupRating)head.append(el("span","digest-group-rating",stars(groupRating)));
      head.append(el("span","digest-group-count",String(items.length)+"件"));
      box.append(head);
      for(const item of items)box.append(article(item,sec.id));
      frag.append(box);
    }
    sectionsBox.append(frag);
    count.textContent = visible.toLocaleString("ja-JP")+"件 / 全"+total.toLocaleString("ja-JP")+"件";
    if(!visible)sectionsBox.append(el("p","digest-empty","該当するニュースはありません。検索条件を変更してください。"));
  }
  function display(data) {
    edition = data;
    activeDate = data.edition_date;
    dateInput.value = activeDate;
    dateInput.max=isoJST();
    panel.dataset.ready="true";
    lead.textContent = data.lead || "当日のニュースを分野別に掲載しています。";
    categoryOptions();
    render();
    setStatus("AI編集版 " + data.edition_date + " ／ 毎朝8時の定期配信", "ready");
    const warning=$("digestWarnings");
    const errors=Array.isArray(data.warnings)?data.warnings.filter(Boolean):[];
    warning.textContent=errors.length?"確認事項: "+errors.join(" ／ "):"";
  }
  async function loadExact(day){
    const serial=++requestSerial;
    setStatus(day+" のニュースを読み込み中…","loading");
    try{
      const data=await readEdition(day);
      if(serial!==requestSerial)return;
      display(data);
    }catch{
      if(serial!==requestSerial)return;
      edition=null;activeDate=day;dateInput.value=day;
      sectionsBox.replaceChildren();
      lead.textContent="選択した日付のAI編集版はまだありません。";
      count.textContent="—";
      $("digestWarnings").textContent="";
      setStatus(day+" の配信データがありません。別の日付を選択してください。","empty");
    }
  }
  async function loadLatest() {
    const serial=++requestSerial;
    setStatus("AI編集版の公開状態を確認しています…","loading");
    const today=isoJST();
    let health=null;
    try{
      const resp=await fetch("./data/editorial/health.json",{cache:"no-store"});
      if(resp.ok) health=await resp.json();
    }catch {}
    if(serial!==requestSerial)return;
    const candidates=[];
    if(health?.last_published?.date && validDate(health.last_published.date)){
      candidates.push(health.last_published.date);
    }
    for(let i=0;i<14;i++){
      const d=pastDay(today,i);
      if(!candidates.includes(d))candidates.push(d);
    }
    for(const d of candidates){
      try{
        const data=await readEdition(d);
        if(serial!==requestSerial)return;
        display(data);
        if(d!==today){
          setStatus("最新AI編集版 "+d+" ／ 本日分は未配信","empty");
          const warning=$("digestWarnings");
          const text="本日 "+today+" のAI編集版はGitHubへの保存を確認できません。RSSニュースは通常どおり利用できます。";
          warning.textContent=warning.textContent?text+" "+warning.textContent:text;
        }
        return;
      }catch {}
    }
    if(serial!==requestSerial)return;
    edition=null;
    sectionsBox.replaceChildren();
    lead.textContent="AI編集版はまだ公開されていません。ChatGPT日次タスクがGitHubへの保存に成功するまで、通常のRSS見出しをご利用ください。";
    count.textContent="—";
    dateInput.value=today;
    $("digestWarnings").textContent=health?.invalid_editions?.length?
      "AI編集版の検証エラー: "+health.invalid_editions.map(x=>x.date+": "+x.reason).join(" ／ "):"";
    setStatus("AI編集版 未配信／RSSヘッドラインは利用可能","empty");
  }
  category.addEventListener("change",render);
  rating.addEventListener("change",render);
  query.addEventListener("input",render);
  dateInput.addEventListener("change",()=>{if(validDate(dateInput.value))loadExact(dateInput.value)});
  newestButton.addEventListener("click",loadLatest);
  loadLatest();
})();
