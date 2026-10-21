#!/usr/bin/env python3
import datetime as dt, hashlib, html, json, re, urllib.request, xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
JST=ZoneInfo("Asia/Tokyo")
def text(el,names):
    for child in el:
        if child.tag.split("}")[-1].lower() in names:
            return "".join(child.itertext()).strip()
    return ""
def clean(s):
    return re.sub(r"\\s+"," ",re.sub(r"<[^>]*>"," ",html.unescape(s or ""))).strip()
def classify(title):
    if re.search("日銀|利上げ|利下げ|FRB|政策金利|国債|社債|GDP|金融庁|金融政策",title,re.I): cat="finance"
    elif re.search("不動産|住宅|地価|マンション|REIT|賃貸",title,re.I): cat="realestate"
    elif re.search("法律|法改正|国会|内閣|法案|閣議|選挙|税制",title,re.I): cat="politics"
    elif re.search("AI|半導体|科学|量子|宇宙|サイバー",title,re.I): cat="technology"
    elif re.search("企業|決算|倒産|M&A|買収|上場",title,re.I): cat="companies"
    else: cat=None
    priority="C" if re.search("PR|広告|キャンペーン|セール",title,re.I) else "A" if re.search("政策金利|利上げ|利下げ|法改正|破綻|地震|津波|戦争|停戦|金融危機|税制改正",title,re.I) else "B"
    return cat,priority
def getfeed(source,now):
    req=urllib.request.Request(source["url"],headers={"User-Agent":"Mozilla/5.0 DailyBrief/1.0","Accept":"application/rss+xml, application/atom+xml, application/xml"})
    with urllib.request.urlopen(req,timeout=20) as response: raw=response.read(2000000)
    root=ET.fromstring(raw)
    out=[]
    for item in root.iter():
        if item.tag.split("}")[-1].lower() not in ("item","entry"):continue
        title=clean(text(item,{"title"}))[:400]
        link=""
        for child in item:
            if child.tag.split("}")[-1]=="link":
                link=child.attrib.get("href") or (child.text or "").strip()
                if link:break
        if not link.startswith(("https://","http://")) or not title:continue
        datestr=text(item,{"pubdate","published","updated","date"})
        try: published=parsedate_to_datetime(datestr)
        except Exception:
            try: published=dt.datetime.fromisoformat(datestr.replace("Z","+00:00"))
            except Exception: published=now
        if not published.tzinfo:published=published.replace(tzinfo=JST)
        published=published.astimezone(JST)
        if published.date()<now.date()-dt.timedelta(days=365) or published.date()>now.date()+dt.timedelta(days=1):continue
        override_cat,priority=classify(title)
        summary=clean(text(item,{"description","summary","encoded"}))[:180]
        day=published.date().isoformat()
        ident=hashlib.sha256((day+"|"+re.sub(r"\\W+","",title).lower()).encode()).hexdigest()[:20]
        out.append({"id":ident,"title":title,"url":link,"source":source["name"],"source_id":source["id"],"category":override_cat or source["category"],"importance":priority,"published_at":published.isoformat(timespec="seconds"),"summary":summary})
    return out
def run():
    now=dt.datetime.now(JST)
    sources=json.loads((ROOT/"config/sources.json").read_text())
    base=ROOT/"data"; dayspath=base/"days"; dayspath.mkdir(parents=True,exist_ok=True)
    days={}
    for file in dayspath.glob("????-??-??.json"):
        try:days[file.stem]={item["id"]:item for item in json.loads(file.read_text())["articles"]}
        except Exception as e:print("WARN",file.name,str(e))
    successes=0;errors=[];added=0
    for source in sources:
        try:
            items=getfeed(source,now)
            if not items:raise ValueError("No valid articles")
            successes+=1
            for a in items:
                date=a["published_at"][:10]
                entry=days.setdefault(date,{})
                if a["id"] not in entry:entry[a["id"]]=a;added+=1
            print("OK",source["id"],len(items))
        except Exception as e:errors.append(source["id"]);print("ERROR",source["id"],str(e))
    if not successes:raise RuntimeError("All RSS requests failed; preserved existing data")
    entries=[]
    for date in sorted(days,reverse=True):
        if dt.date.fromisoformat(date)<now.date()-dt.timedelta(days=365):
            (dayspath/(date+".json")).unlink(missing_ok=True)
            continue
        articles=sorted(days[date].values(),key=lambda a:(a["importance"],a["published_at"]),reverse=False)
        articles.sort(key=lambda a:a["published_at"],reverse=True)
        articles.sort(key=lambda a:a["importance"])
        (dayspath/(date+".json")).write_text(json.dumps({"date":date,"articles":articles},ensure_ascii=False,indent=2))
        entries.append({"date":date,"count":len(articles),"importance_A":sum(a["importance"]=="A" for a in articles),"importance_B":sum(a["importance"]=="B" for a in articles)})
    (base/"index.json").write_text(json.dumps({"updated_at":now.isoformat(),"days":entries,"sources_ok":successes,"sources_total":len(sources),"sources_failed":errors,"new_items":added},ensure_ascii=False,indent=2))
    print("DONE",added,"new articles, sources",successes,"/",len(sources))
if __name__=="__main__":run()
