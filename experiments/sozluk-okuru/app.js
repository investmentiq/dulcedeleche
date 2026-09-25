const SAMPLE_DATA={
  popular:[
    {TopicId:5423457,Title:"tayland'da uzun süre yaşamak",FullCount:214},
    {TopicId:4831021,Title:"yapay zekânın günlük hayata etkisi",FullCount:389},
    {TopicId:3768910,Title:"istanbul'da bir eylül günü",FullCount:117},
    {TopicId:6912044,Title:"macbook pro'yu yıllarca kullanmak",FullCount:82},
    {TopicId:8124102,Title:"uzaktan çalışmanın görünmeyen tarafları",FullCount:164},
    {TopicId:2500911,Title:"kahve içmek için en doğru saat",FullCount:53}
  ],
  today:[
    {TopicId:9021001,Title:"bugün öğrendiğim küçük ama işe yarar bilgi",FullCount:97},
    {TopicId:9021002,Title:"şehir değiştirince değişen alışkanlıklar",FullCount:61},
    {TopicId:9021003,Title:"telefon yerine bilgisayarda çalışmanın rahatlığı",FullCount:43},
    {TopicId:9021004,Title:"yağmur bastırınca sığınılan yerler",FullCount:28}
  ],
  debe:[
    {TopicId:8110001,EntryId:8110001,Title:"insanın kendi düzenini yeniden kurması"},
    {TopicId:8110002,EntryId:8110002,Title:"başka bir ülkede gündelik hayat gözlemleri"},
    {TopicId:8110003,EntryId:8110003,Title:"teknolojiyle hayatı biraz daha sadeleştirmek"}
  ]
};
const SAMPLE_ENTRIES=[
  {Id:162001,Author:{Nick:"gezginokur",Id:1},Created:"2026-09-25T10:24:00+03:00",FavoriteCount:18,CommentCount:3,Content:"Bir yerde uzun süre kalınca turist gibi değil, gündelik hayatın ritmiyle bakmaya başlıyorsun. Market, ulaşım, kahve, spor salonu ve yürünebilirlik bir anda manzaradan daha önemli oluyor."},
  {Id:162002,Author:{Nick:"sessiznotlar",Id:2},Created:"2026-09-25T11:07:00+03:00",FavoriteCount:11,CommentCount:1,Content:"Bence en büyük fark seçenek çokluğu değil; küçük günlük sürtünmelerin ne kadar az olduğu. Bir şehir insana bunu veriyorsa uzun kalmak kolaylaşıyor."}
];

const $=(s)=>document.querySelector(s);
const API_KEY="mgl-sozluk-api-base";
const BOOKMARK_KEY="mgl-sozluk-bookmarks";
const THEME_KEY="mgl-sozluk-theme";
let qs=new URLSearchParams(location.search);

function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function num(value,fallback=1){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?Math.floor(n):fallback;
}
function pageValue(){return Math.min(250,num(qs.get("page"),1));}
function saved(){
  try{return JSON.parse(localStorage.getItem(BOOKMARK_KEY)||"[]");}catch{return [];}
}
function setSaved(items){localStorage.setItem(BOOKMARK_KEY,JSON.stringify(items));}
const DEFAULT_API_BASE="https://mgl-sozluk-api.investilogiusa.workers.dev";
function currentApiBase(){return (localStorage.getItem(API_KEY)||DEFAULT_API_BASE).replace(/\/$/,"");}
function configureApiFromQuery(){
  const raw=(qs.get("api")||"").trim();
  if(!raw)return;
  try{
    const url=new URL(raw);
    if(url.protocol!=="https:")throw new Error("HTTPS required");
    localStorage.setItem(API_KEY,url.origin+url.pathname.replace(/\/$/,""));
    qs.delete("api");
    const clean=location.pathname+(qs.toString()?"?"+qs.toString():"");
    history.replaceState(null,"",clean);
  }catch{}
}
configureApiFromQuery();

async function apiGet(route,params={}){
  const base=currentApiBase();
  if(!base)throw new Error("API_NOT_CONFIGURED");
  const url=new URL(base+route);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  const response=await fetch(url.toString(),{headers:{Accept:"application/json"}});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload?.ok)throw new Error(payload?.error||("API "+response.status));
  return payload.data;
}
function trDate(input){
  if(!input)return"";
  try{return new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(input));}catch{return String(input);}
}
const ISTANBUL_DAY_FORMATTER=new Intl.DateTimeFormat("en-US",{
  timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"
});
function istanbulDayKey(input){
  try{
    const parts=Object.fromEntries(ISTANBUL_DAY_FORMATTER.formatToParts(new Date(input)).map(p=>[p.type,p.value]));
    return parts.year+"-"+parts.month+"-"+parts.day;
  }catch{return"";}
}
async function locateCurrentDay(id,firstPage){
  const today=istanbulDayKey(new Date());
  const total=Math.max(1,Number(firstPage.PageCount||1));
  const cache=new Map([[Number(firstPage.PageIndex||1),firstPage]]);
  const getPage=async page=>{
    if(cache.has(page))return cache.get(page);
    const data=await apiGet("/v1/topic",{id,page});
    cache.set(page,data);
    return data;
  };
  let low=1,high=total,candidate=null;
  while(low<=high){
    const mid=Math.floor((low+high)/2);
    const data=await getPage(mid);
    const entries=data.Entries||[];
    const lastDay=entries.length?istanbulDayKey(entries[entries.length-1].Created):"";
    if(lastDay&&lastDay>=today){
      candidate=mid;
      high=mid-1;
    }else{
      low=mid+1;
    }
  }
  if(candidate===null){
    const data=await getPage(total);
    return {data,entryId:0};
  }
  for(let page=candidate;page<=Math.min(total,candidate+1);page++){
    const data=await getPage(page);
    const entry=(data.Entries||[]).find(item=>istanbulDayKey(item.Created)===today);
    if(entry)return {data,entryId:Number(entry.Id||0)};
  }
  const data=await getPage(total);
  return {data,entryId:0};
}
function linkify(text){
  const safe=escapeHtml(text);
  return safe.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi,raw=>{
    const clean=raw.replace(/[),.;!?]+$/,"");
    const punctuation=raw.slice(clean.length);
    const href=clean.startsWith("www.")?"https://"+clean:clean;
    return '<a class="entryLink" href="'+href+'" target="_blank" rel="noopener noreferrer">'+clean+"</a>"+punctuation;
  });
}
function header(query=""){
  const live=!!currentApiBase();
  return '<header class="topbar">'+
    '<a class="brand" href="./" aria-label="sözlük okuru ana sayfa"><span class="brandMark">s</span><span class="brandText"><strong>sözlük okuru</strong><small>reader / anonymous</small></span></a>'+
    '<form class="search" action="./"><input name="q" value="'+escapeHtml(query)+'" placeholder="başlık ara · @yazar · #entry…"><button>ara</button></form>'+
    '<div class="headerActions"><a class="labs" href="../../">MGL // LABS</a><select id="theme" class="theme" aria-label="Renk teması"><option value="dark">koyu</option><option value="light">açık</option></select>'+
    '<span class="status '+(live?"liveApi":"")+'"><i></i>'+(live?"canlı api":"prototip")+"</span></div></header>"+
    (live?'<div class="previewBar liveBar"><span class="previewFlag">MGL live</span><strong>Canlı veri.</strong> Okuma modu anonim ve salt okunur.</div>':'<div class="previewBar"><span class="previewFlag">MGL prototype</span><strong>API bağlantısı bekleniyor.</strong> Şimdilik örnek veri gösteriliyor.</div>');
}
function topicCard(item,index,tag){
  const topicId=Number(item.TopicId||item.Id||item.EntryId);
  const entryId=Number(item.EntryId||0);
  const count=item.MatchedCount??item.FullCount??"";
  const href=entryId?"?entry="+entryId:"?topic="+topicId;
  return '<a class="topic" href="'+href+'"><span class="rank">'+String(index+1).padStart(2,"0")+'</span><span class="topicBody"><small>'+escapeHtml(tag)+'</small><strong>'+escapeHtml(item.Title||item.title||"")+'</strong></span><span class="count">'+escapeHtml(count)+'<small>'+(entryId?"#"+entryId:"entry")+'</small></span><span class="arrow">↗</span></a>';
}
function aside(){
  const items=saved();
  return '<aside><div class="asideHead"><span>okuma listem</span><em>'+items.length+'</em></div>'+
    (items.length?'<div class="savedList">'+items.map(x=>'<a href="?topic='+x.id+'">'+escapeHtml(x.title)+'<span>↗</span></a>').join("")+'</div>':'<div class="emptyState"><span class="bookmark">◇</span><strong>Henüz sessiz.</strong><p>Takip etmek istediğin başlıkları burada biriktirebilirsin.</p></div>')+
    '<div class="readerNote"><span>okur notu</span><p>Kayıtların yalnızca bu tarayıcıda tutulur.</p></div></aside>';
}
function pager(page,total,params){
  total=Math.max(1,Number(total)||1);
  if(total<=1)return"";
  const make=p=>{const u=new URLSearchParams(params);u.set("page",String(p));return"?"+u.toString();};
  return '<nav class="pager" aria-label="sayfalar"><div class="pagerSteps">'+
    (page>1?'<a href="'+make(1)+'">« ilk</a><a href="'+make(page-1)+'">← önceki</a>':'<a class="disabled">« ilk</a>')+
    '</div><form class="pageJump" action="./">'+Object.entries(params).map(([k,v])=>'<input type="hidden" name="'+escapeHtml(k)+'" value="'+escapeHtml(v)+'">').join("")+
    '<label>sayfa</label><input name="page" type="number" min="1" max="'+total+'" value="'+page+'"><span>/ '+total+'</span><button>git</button></form><div class="pagerSteps">'+
    (page<total?'<a href="'+make(page+1)+'">sonraki →</a><a href="'+make(total)+'">son »</a>':'<a class="disabled">son »</a>')+"</div></nav>";
}
function entryCard(item){
  const author=item.Author?.Nick||"anonim";
  return '<article class="entryCard" id="entry-'+Number(item.Id||0)+'"><div class="entryText">'+linkify(item.Content||"")+'</div><footer><a href="?q=@'+encodeURIComponent(author)+'">@'+escapeHtml(author)+'</a><span>'+escapeHtml(trDate(item.Created))+'</span><span>★ '+Number(item.FavoriteCount||0)+'</span><span>yorum '+Number(item.CommentCount||0)+'</span><a class="entryId" href="?entry='+Number(item.Id||0)+'">#'+Number(item.Id||0)+"</a></footer></article>";
}
function setupChrome(){
  const theme=$("#theme");
  const stored=localStorage.getItem(THEME_KEY)||"dark";
  document.documentElement.dataset.theme=stored;
  if(theme){
    theme.value=stored;
    theme.onchange=()=>{document.documentElement.dataset.theme=theme.value;localStorage.setItem(THEME_KEY,theme.value);};
  }
  const button=$("#save");
  if(button){
    button.onclick=()=>{
      const id=Number(button.dataset.id),title=button.dataset.title||"başlık";
      let items=saved();
      items=items.some(x=>x.id===id)?items.filter(x=>x.id!==id):[...items,{id,title}];
      setSaved(items);
      button.textContent=items.some(x=>x.id===id)?"✓ listemde":"+ listeme ekle";
    };
  }
}
function loadingView(){
  $("#app").innerHTML=header(qs.get("q")||"")+'<section class="loadingView"><span></span><p>akış bağlanıyor…</p></section>';
  setupChrome();
}
function errorView(message){
  $("#app").innerHTML=header(qs.get("q")||"")+'<section class="errorView"><span>bağlantı notu</span><h1>Akışa ulaşılamadı.</h1><p>'+escapeHtml(message)+'</p><a href="./">yeniden dene</a></section>';
  setupChrome();
}

async function loadHome(query,feedName,page){
  let payload,topics,total=1;
  if(currentApiBase()){
    if(query){
      payload=await apiGet("/v1/search",{q:query,page});
      topics=payload.Topics||[];
    }else{
      payload=await apiGet("/v1/feed",{kind:feedName,page});
      topics=feedName==="debe"?(payload.DebeItems||[]).map(x=>({TopicId:Number(x.EntryId),EntryId:Number(x.EntryId),Title:String(x.Title||"")})):(payload.Topics||[]);
    }
    total=Number(payload.PageCount||1);
  }else{
    const source=SAMPLE_DATA[feedName]||SAMPLE_DATA.popular;
    topics=query?[...SAMPLE_DATA.popular,...SAMPLE_DATA.today,...SAMPLE_DATA.debe].filter(t=>String(t.Title).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"))):source;
  }
  const labels={popular:"gündem",today:"bugün",debe:"debe"};
  const now=new Date();
  const day=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long"}).format(now);
  const weekday=new Intl.DateTimeFormat("tr-TR",{weekday:"long"}).format(now);
  $("#app").innerHTML=header(query)+
    '<section class="hero"><div><p class="eyebrow">ekşi sözlük, gürültüsü azaltılmış</p><h1>'+(query?"“"+escapeHtml(query)+"”":"Ne konuşuluyor?")+'</h1><p class="intro">'+(query?topics.length+" sonuç gösteriliyor. Başlığa geçmek için bir sonuca dokun.":"Gündemi sakin bir akışta oku. Başlıkları tara, entry’lerde ara ve kaldığın yeri kaybetme.")+'</p></div><div class="dateCard"><span>'+day+'</span><strong>'+weekday+'</strong><small>anonim · salt okunur</small></div></section>'+
    '<nav class="tabs"><a class="'+(!query&&feedName==="popular"?"active":"")+'" href="?feed=popular">gündem</a><a class="'+(!query&&feedName==="today"?"active":"")+'" href="?feed=today">bugün</a><a class="'+(!query&&feedName==="debe"?"active":"")+'" href="?feed=debe">debe</a></nav>'+
    '<section class="contentGrid"><div>'+topics.map((t,i)=>topicCard(t,i,query?"arama sonucu":labels[feedName])).join("")+
    pager(page,total,query?{q:query}:{feed:feedName})+"</div>"+aside()+"</section>";
  setupChrome();
}
async function loadTopic(id,page,preferCurrentDay=false){
  let data,todayEntryId=0;
  if(currentApiBase()){
    data=await apiGet("/v1/topic",{id,page});
    if(preferCurrentDay){
      const located=await locateCurrentDay(id,data);
      data=located.data;
      todayEntryId=located.entryId;
      const actualPage=Number(data.PageIndex||page);
      const clean="?topic="+id+"&page="+actualPage+(todayEntryId?"#entry-"+todayEntryId:"");
      history.replaceState(null,"",clean);
    }
  }else{
    data={Id:id,Title:(SAMPLE_DATA.popular.find(x=>x.TopicId===id)?.Title||"örnek başlık"),Entries:SAMPLE_ENTRIES,PageCount:1,PageIndex:1,EntryCounts:{Total:SAMPLE_ENTRIES.length}};
  }
  const actualPage=Number(data.PageIndex||page);
  const isSaved=saved().some(x=>x.id===Number(data.Id||id));
  $("#app").innerHTML=header()+
    '<section class="detailHero"><div><p class="eyebrow">başlık · '+escapeHtml(data.EntryCounts?.Total??"")+' entry</p><h1>'+escapeHtml(data.Title||"")+'</h1></div><button class="saveButton" id="save" data-id="'+Number(data.Id||id)+'" data-title="'+escapeHtml(data.Title||"")+'">'+(isSaved?"✓ listemde":"+ listeme ekle")+'</button></section>'+
    '<div class="topicTools"><a class="topicBack" href="./">← gündeme dön</a>'+pager(actualPage,Number(data.PageCount||1),{topic:id})+'</div>'+
    '<section class="readingColumn">'+(data.Entries||[]).map(entryCard).join("")+pager(actualPage,Number(data.PageCount||1),{topic:id})+"</section>";
  setupChrome();
  if(todayEntryId){
    requestAnimationFrame(()=>{
      const target=document.getElementById("entry-"+todayEntryId);
      if(target)target.scrollIntoView({block:"start"});
    });
  }
}
async function loadEntry(id,query){
  let data;
  if(currentApiBase())data=await apiGet("/v1/entry",{id});
  else data={Id:5423457,Title:SAMPLE_DATA.popular[0].Title,Entries:SAMPLE_ENTRIES.slice(0,1)};
  $("#app").innerHTML=header(query)+
    '<section class="detailHero"><div><p class="eyebrow">tek entry · #'+id+'</p><h1>'+escapeHtml(data.Title||"")+'</h1></div><a class="saveButton" href="?topic='+Number(data.Id||0)+'">başlığın tamamı →</a></section>'+
    '<section class="readingColumn">'+(data.Entries||[]).map(entryCard).join("")+"</section>";
  setupChrome();
}
async function loadUser(nick,query){
  if(!currentApiBase()){
    $("#app").innerHTML=header(query)+'<section class="profileHero"><span class="avatar">'+escapeHtml(nick.slice(0,1).toLocaleUpperCase("tr"))+'</span><div><p class="eyebrow">yazar profili</p><h1>@'+escapeHtml(nick)+'</h1><p>Canlı API bağlandığında gerçek profil bilgileri burada görünecek.</p></div></section><section class="profileStats"><div><strong>—</strong><span>entry</span></div><div><strong>—</strong><span>takipçi</span></div><div><strong>—</strong><span>takip</span></div><div><strong>—</strong><span>karma</span></div></section><a class="backLink" href="./">← gündeme dön</a>';
    setupChrome();return;
  }
  const data=await apiGet("/v1/user",{nick});
  const info=data.UserInfo||{},identity=info.UserIdentifier||{},counts=info.EntryCounts||{},karma=info.Karma||{};
  $("#app").innerHTML=header(query)+'<section class="profileHero"><span class="avatar">'+escapeHtml(nick.slice(0,1).toLocaleUpperCase("tr"))+'</span><div><p class="eyebrow">yazar profili</p><h1>@'+escapeHtml(identity.Nick||nick)+'</h1><p>'+escapeHtml(data.Biograpyh||"biyografi yok")+'</p></div></section><section class="profileStats"><div><strong>'+escapeHtml(counts.Total||0)+'</strong><span>entry</span></div><div><strong>'+escapeHtml(data.FollowerCount||0)+'</strong><span>takipçi</span></div><div><strong>'+escapeHtml(data.FollowingsCount||0)+'</strong><span>takip</span></div><div><strong>'+escapeHtml(karma.Name||"—")+'</strong><span>karma</span></div></section><a class="backLink" href="./">← gündeme dön</a>';
  setupChrome();
}

async function render(){
  qs=new URLSearchParams(location.search);
  const query=(qs.get("q")||"").trim();
  const topicId=Math.max(0,Number(qs.get("topic"))||0);
  const entryParam=Math.max(0,Number(qs.get("entry"))||0);
  const page=pageValue();
  const feedName=["popular","today","debe"].includes(qs.get("feed"))?qs.get("feed"):"popular";
  loadingView();
  try{
    if(topicId)return await loadTopic(topicId,page,!qs.has("page"));
    if(entryParam||query.startsWith("#"))return await loadEntry(entryParam||num(query.slice(1),0),query);
    if(query.startsWith("@"))return await loadUser(query.slice(1).trim(),query);
    return await loadHome(query,feedName,page);
  }catch(error){
    errorView(error instanceof Error?error.message:"Bilinmeyen bir bağlantı hatası oluştu.");
  }
}
render();
