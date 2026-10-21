/* DAILY BRIEF : on-page background related-news exploration.
   Source material is RSS headline and publisher-provided excerpt; no AI or fabricated analysis. */
(() => {
  "use strict";
  const dayCache = new Map();
  const MAX_DAYS = 8;
  const MAX_RELATED = 6;
  const STOP = /ニュース|について|についての|発表|報道|速報|最新|注目|まとめ|明らか|可能性|国内|海外|日本|政府|関係者|問題|対応|今後|情報|更新|受けて/g;
  const TERMS = [
    "日本銀行","日銀","政策金利","利上げ","利下げ","住宅ローン","長期金利","国債","FRB","FOMC","雇用統計","インフレ","物価","為替","円安","円高",
    "米国","中国","台湾","ロシア","ウクライナ","中東","イスラエル","原油","関税","選挙","総選挙","衆議院","参議院","内閣","首相",
    "税制改正","所得税","消費税","法人税","相続税","法改正","最高裁","不動産","マンション","地価","賃料","REIT",
    "日経平均","TOPIX","S&P500","ビットコイン","暗号資産","AI","人工知能","半導体","NVIDIA","GPU","データセンター",
    "トヨタ","ソフトバンク","ソニー","任天堂","東電","東京電力","決算","TOB","買収","倒産","破綻",
    "地震","津波","台風","大雨","豪雨","停戦","戦争","外交","GDP","景気","消費者物価"
  ];
  const ALIASES = [["日本銀行","日銀"],["人工知能","AI"],["東京電力","東電"],["米連邦準備制度","FRB"]];
  function safeURL(value) {
    try { const x = new URL(value); return /^(https?:)$/.test(x.protocol) ? x.toString() : null; }
    catch { return null; }
  }
  function node(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function normalize(s) {
    let x = String(s || "").normalize("NFKC").toLocaleLowerCase("ja-JP");
    for (const [a,b] of ALIASES) x=x.replaceAll(a.toLocaleLowerCase("ja-JP"),b.toLocaleLowerCase("ja-JP"));
    return x.replace(/\([^()]{2,80}\)\s*$/g, " ").replace(/【[^】]+】|\[[^\]]+\]/g, " ").replace(STOP, " ").replace(/https?:\/\/\S+/g, " ");
  }
  function grams(title) {
    const value = normalize(title);
    const words = new Set();
    for (const w of value.match(/[一-龥々〆ヶぁ-んァ-ヴー]+|[a-z][a-z0-9.+-]*|\d+(?:\.\d+)?%?/g) || []) {
      if (/^[一-龥々〆ヶぁ-んァ-ヴー]+$/.test(w)) {
        for (let i=0;i<=w.length-3;i++) words.add("j:"+w.slice(i,i+3));
        if (w.length===2) words.add("j2:"+w);
      } else if (w.length>=2) words.add("w:"+w);
    }
    for (const term of TERMS) {
      const alias = normalize(term).trim();
      if (alias.length>1 && value.includes(alias)) words.add("e:"+alias);
    }
    return words;
  }
  function sortRelated(article, all) {
    const base = grams(article.title);
    const candidates = all.filter(a=>a && a.id!==article.id && a.title && safeURL(a.url) && !a.is_demo);
    const tokenized = candidates.map(a=>({article:a,t:grams(a.title)}));
    const docFreq = new Map();
    for (const item of tokenized) for (const term of item.t) docFreq.set(term,(docFreq.get(term)||0)+1);
    const N = tokenized.length + 1;
    const idf = t => 1+Math.log(1 + N/(1+(docFreq.get(t)||0)));
    const baseWeight = [...base].reduce((sum,t)=>sum+idf(t),0);
    const list=[];
    for (const entry of tokenized) {
      if ((article.url||"")===entry.article.url) continue;
      const overlap = [...base].filter(t=>entry.t.has(t));
      const rare = overlap.reduce((s,t)=>s+idf(t),0);
      const allWeight = [...entry.t].reduce((s,t)=>s+idf(t),0);
      const score = rare / Math.max(1,baseWeight+allWeight-rare);
      const entities = overlap.filter(t=>t.startsWith("e:")).length;
      const originalTitle = normalize(article.title);
      const relatedTitle = normalize(entry.article.title);
      // Avoid unrelated cryptocurrency news for an article about a named company.
      const distinctive = [...originalTitle.matchAll(/\b[a-z][a-z0-9]{3,}\b/g)]
        .map(match=>match[0]).filter(w=>!["news","today","japan","world","daily","breaking"].includes(w));
      if(distinctive.length && !distinctive.some(w=>relatedTitle.includes(w))) continue;
      // Earthquakes in different epicenters or with different magnitudes are separate events.
      if(originalTitle.includes("地震") && relatedTitle.includes("地震")) {
        const origin = originalTitle.match(/震源(?:地)?(?:は|が|[:：])\s*([^\s、。)（）]{3,22})/);
        const other = relatedTitle.match(/震源(?:地)?(?:は|が|[:：])\s*([^\s、。)（）]{3,22})/);
        if(origin && other && origin[1]!==other[1] && !origin[1].includes(other[1]) && !other[1].includes(origin[1])) continue;
        const magnitude = originalTitle.match(/(?:\bm|マグニチュード)\s*([0-9]+(?:\.[0-9]+)?)/i);
        const otherMagnitude = relatedTitle.match(/(?:\bm|マグニチュード)\s*([0-9]+(?:\.[0-9]+)?)/i);
        if(magnitude && otherMagnitude && Math.abs(Number(magnitude[1])-Number(otherMagnitude[1]))>0.15) continue;
      }
      // Avoid associating unrelated stories merely because they are both financial/political news.
      if ((overlap.length < 2 && !entities) || (score < .105 && !(entities>=2 && score>=.065))) continue;
      const published = Date.parse(entry.article.published_at||"")||0;
      list.push({...entry,score,entities,published});
    }
    list.sort((a,b)=>b.score-a.score || b.entities-a.entities || b.published-a.published);
    const seen=new Set();
    return list.filter(x=>{
      const key=normalize(x.article.title).replace(/\s+/g,"").slice(0,85);
      if (seen.has(key)) return false;
      seen.add(key);return true;
    }).slice(0,MAX_RELATED).map(x=>x.article);
  }
  function sameWindow(date, indexDays) {
    const anchor=Date.parse(date+"T00:00:00+09:00");
    return (indexDays||[]).map(d=>d.date).filter(d=>{
      const timestamp=Date.parse(d+"T00:00:00+09:00");
      return Number.isFinite(timestamp) && timestamp<=anchor+86400000 && timestamp>=anchor-7*86400000;
    }).slice(0,MAX_DAYS);
  }
  async function getDay(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    if (!dayCache.has(date)) {
      const promise = fetch("./data/days/"+encodeURIComponent(date)+".json",{cache:"no-store"})
        .then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})
        .then(data=>Array.isArray(data.articles)?data.articles:[])
        .catch(err=>{dayCache.delete(date);throw err});
      dayCache.set(date,promise);
    }
    return dayCache.get(date);
  }
  function empty(container) {container.replaceChildren();}
  function sectionTitle(text,tag="h4"){return node(tag,"insight-heading",text);}
  function describe(article) {
    const s=(article.summary||"").trim();
    return s && s!==article.title ? s : "この配信元のRSSには記事の詳しい概要がありません。記事名と関連記事を参照するか、原文をご確認ください。";
  }
  function renderIntro(container,article) {
    container.append(node("div","insight-overline","NEWS CONTEXT  /  自動検索"));
    container.append(sectionTitle("このニュースの概要","h3"));
    container.append(node("p","insight-summary",describe(article)));
    container.append(node("p","insight-caveat","概要は配信元のRSS記載を引用ではなく短く表示したものです。記事本文の取得、AIによる要約や事実検証は行っていません。"));
  }
  function formatDate(article) {
    const date=new Date(article.published_at||"");
    if(Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);
  }
  function renderRelated(container,related,failures) {
    const head=node("div","insight-relhead");
    const title=sectionTitle("関連ニュース");
    head.append(title,node("span","insight-related-count",related.length+"件"));
    container.append(head);
    if (!related.length) {
      container.append(node("p","insight-empty","配信データ内で十分に近い話題は見つかりませんでした。関連度を無理に広げず、誤った関連付けを避けています。"));
    } else {
      const list=node("div","insight-related-list");
      for(const article of related) {
        const u=safeURL(article.url);if(!u)continue;
        const row=node("a","insight-related-item"); row.href=u;row.target="_blank";row.rel="noopener noreferrer";
        const meta=node("div","insight-related-meta",(article.source||"配信元不明")+"  ·  "+formatDate(article));
        const headline=node("div","insight-related-title",article.title);
        row.append(meta,headline);
        if(article.summary && article.summary!==article.title)row.append(node("p","insight-related-excerpt",article.summary));
        row.append(node("span","insight-related-arrow","原文 ↗"));
        list.append(row);
      }
      container.append(list);
    }
    if(failures)container.append(node("p","insight-caveat","一部の過去データは取得できず、確認できた範囲で表示しています。"));
    container.append(node("p","insight-method","記事タイトルの共通語句をもとに、選択日から過去7日間の蓄積ニュースを照合しています。関連性は自動推定であり、同一事件とは限りません。"));
  }
  async function render(container, article, options={}) {
    empty(container);
    container.setAttribute("aria-busy","true");
    renderIntro(container,article);
    const status=node("div","insight-loading","過去7日間の記事から関連ニュースを探しています…");
    status.setAttribute("role","status");container.append(status);
    if(article.is_demo){
      status.replaceWith(node("p","insight-empty","こちらは操作確認用の架空のニュースです。実際のニュースが配信されると関連記事が表示されます。"));
      container.setAttribute("aria-busy","false");return;
    }
    const days=sameWindow(options.date||(article.published_at||"").slice(0,10),options.indexDays);
    const cacheDays=days.filter(d=>d!==options.date);
    let failures=0;
    try{
      const reports=await Promise.allSettled(cacheDays.map(getDay));
      const archived=reports.flatMap(r=>{if(r.status==="fulfilled")return r.value;failures++;return []});
      if(!container.isConnected) return;
      const related=sortRelated(article,[...(options.currentItems||[]),...archived]);
      status.remove();
      renderRelated(container,related,failures);
    }catch(err){
      if(!container.isConnected)return;
      status.replaceWith(node("p","insight-empty","関連情報を取得できませんでした。通信状況をご確認のうえ、もう一度お試しください。"));
    }finally{container.setAttribute("aria-busy","false")}
  }
  window.DailyBriefInsight = {render};
})();
