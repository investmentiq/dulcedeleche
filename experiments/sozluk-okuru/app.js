const DATA={
 popular:[
  {id:5423457,title:"tayland'da uzun süre yaşamak",count:214},
  {id:4831021,title:"yapay zekânın günlük hayata etkisi",count:389},
  {id:3768910,title:"istanbul'da bir eylül günü",count:117},
  {id:6912044,title:"macbook pro'yu yıllarca kullanmak",count:82},
  {id:8124102,title:"uzaktan çalışmanın görünmeyen tarafları",count:164},
  {id:2500911,title:"kahve içmek için en doğru saat",count:53}
 ],
 today:[
  {id:9021001,title:"bugün öğrendiğim küçük ama işe yarar bilgi",count:97},
  {id:9021002,title:"şehir değiştirince değişen alışkanlıklar",count:61},
  {id:9021003,title:"telefon yerine bilgisayarda çalışmanın rahatlığı",count:43},
  {id:9021004,title:"yağmur bastırınca sığınılan yerler",count:28}
 ],
 debe:[
  {id:8110001,title:"insanın kendi düzenini yeniden kurması",count:1},
  {id:8110002,title:"başka bir ülkede gündelik hayat gözlemleri",count:1},
  {id:8110003,title:"teknolojiyle hayatı biraz daha sadeleştirmek",count:1}
 ]
};
const ENTRIES={
  5423457:[
    {id:162001,"author":"gezginokur","date":"25 eylül 2026 10:24","fav":18,"comments":3,text":"Bir yerde uzun süre kalınca turist gibi değil, gündelik hayatın ritmiyle bakmaya başlıyorsun. Market, ulaşım, kahve, spor salonu ve yürünebilirlik bir anda manzaradan daha önemli oluyor."},
    {id:162002,"author":"sessiznotlar","date":"25 eylül 2026 11:07","fav":11,"comments":1,text":"Bence en büyük fark seçenek çokluğu değil; küçük günlük sürtünmelerin ne kadar az olduğu. Bir şehir insana bunu veriyorsa uzun kalmak kolaylaşıyor."}
  ]
};
const $=(s)=>document.querySelector(s);
const qs=new URLSearchParams(location.search);
const saved=()=>JSON.parse(localStorage.getItem("mgl-sozluk-preview")||"[]");
const setSaved=x=>localStorage.setItem("mgl-sozluk-preview",JSON.stringify(x));
function header(q=""){return `<header class="topbar"><a class="brand" href="./"><span class="brandMark">s</span><span class="brandText"><strong>sözlük okuru</strong><small>reader / anonymous</small></span></a><form class="search"><input name="q" value="${esc(q)}" placeholder="başlık ara · @yazar · #entry…"><button>ara</button></form><div class="headerActions"><a class="labs" href="../../">MGL // LABS</a><select id="theme" class="theme" aria-label="Renk teması"><option value="dark">koyu</option><option value="light">açık</option></select><span class="status"><i></i>önizleme</span></div></header><div class="previewBar"><span class="previewFlag">MGL preview</span><strong>Tasarım önizlemesi.</strong> Bu GitHub sürümü gerçek Ekşi API'sine bağlı değil; mevcut Sözlük Okuru yayını değişmedi.</div>`}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function topicCard(t,i,tag){return `<a class="topic" href="?topic=${t.id}"><span class="rank">${String(i+1).padStart(2,"0")}</span><span class="topicBody"><small>${tag}</small><strong>${esc(t.title)}</strong></span><span class="count">${t.count}<small>entry</small></span><span class="arrow">↗</span></a>`}
function aside(){const items=saved();return `<aside><div class="asideHead"><span>okuma listem</span><em>${items.length}</em></div>${items.length?`<div class="savedList">${items.map(x=>`<a href="?topic=${x.id}">${esc(x.title)}<span>↗</span></a>`).join("")}</div>`:`<div class="emptyState"><span class="bookmark">◇</span><strong>Henüz sessiz.</strong><p>Takip etmek istediğin başlıkları burada biriktirebilirsin.</p></div>`}<div class="readerNote"><span>okur notu</span><p>Bu önizlemede kayıtlar yalnızca bu tarayıcıda tutulur.</p></div></aside>`}
function home(){
 const q=(qs.get("q")||"").trim(),feed=qs.get("feed")||"popular";
 let topics=DATA[feed]||DATA.popular;
 if(q)topics=[...DATA.popular,...DATA.today,...DATA.debe].filter(t=>t.title.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
 const now=new Date(),day=new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long"}).format(now),weekday=new Intl.DateTimeFormat("tr-TR",{weekday:"long"}).format(now);
 return header(q)+`<section class="hero"><div><p class="eyebrow">ekşi sözlük, gürültüsü azaltılmış</p><h1>${q?`“${esc(q)}”`:"Ne konuşuluyor?"}</h1><p class="intro">${q?`${topics.length} örnek sonuç gösteriliyor. Bu sayfa görsel ve etkileşim önizlemesidir.`:"Gündemi sakin bir akışta oku. Başlıkları tara, entry’lerde ara ve kaldığın yeri kaybetme."}</p></div><div class="dateCard"><span>${day}</span><strong>${weekday}</strong><small>anonim · salt okunur</small></div></section>
 <nav class="tabs"><a class="${!q&&feed==="popular"?"active":""}" href="?feed=popular">gündem</a><a class="${!q&&feed==="today"?"active":""}" href="?feed=today">bugün</a><a class="${!q&&feed==="debe"?"active":""}" href="?feed=debe">debe</a></nav>
 <section class="contentGrid"><div>${topics.length?topics.map((t,i)=>topicCard(t,i,q?"arama sonucu":feed==="popular"?"gündem":feed)).join(""):'<div class="emptyResults">Bu aramayla eşleşen örnek başlık yok.</div>'}</div>${aside()}</section>`;
}
function detail(id){
 const all=[...DATA.popular,...DATA.today,...DATA.debe],t=all.find(x=>x.id===id)||{id,title:"örnek başlık",count:2};const items=ENTRIES[id]||ENTRIES[5423457];const isSaved=saved().some(x=>x.id===id);
 return header()+`<section class="detailHero"><div><p class="eyebrow">başlık · ${t.count} entry</p><h1>${esc(t.title)}</h1></div><button class="saveButton" id="save">${isSaved?"✓ listemde":"+ listeme ekle"}</button></section><a class="back" href="./">← gündeme dön</a><section class="readingColumn">${items.map(x=>`<article class="entryCard"><div class="entryText">${esc(x.text)}</div><footer><a href="?q=@${x.author}">@${x.author}</a><span>${x.date}</span><span>★ ${x.fav}</span><span>yorum ${x.comments}</span><a class="entryId">#${x.id}</a></footer></article>`).join("")}</section>`;
}
function render(){const id=Number(qs.get("topic")||0);$("#app").innerHTML=id?detail(id):home();const theme=$("#theme"),stored=localStorage.getItem("mgl-sozluk-theme")||"dark";document.documentElement.dataset.theme=stored;if(theme){theme.value=stored;theme.onchange=()=>{document.documentElement.dataset.theme=theme.value;localStorage.setItem("mgl-sozluk-theme",theme.value)}}const save=$("#save");if(save){save.onclick=()=>{const id=Number(qs.get("topic")),all=[...DATA.popular,...DATA.today,...DATA.debe],t=all.find(x=>x.id===id)||{id,title:"örnek başlık"};let items=saved();items=items.some(x=>x.id===id)?items.filter(x=>x.id!==id):[...items,{id,title:t.title}];setSaved(items);render()}}}
render();