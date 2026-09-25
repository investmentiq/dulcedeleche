import {CITIES,LAND} from './data.mjs';
import {solarVector,altitude,statusFor,normalizeSelection,placeLabels} from './core.mjs';
const $=s=>document.querySelector(s), defaults=['Pattaya','Istanbul','London','New York','Nashville'];
const zoneDetails={
 'America/Chicago':'Central Time · CST / CDT',
 'America/New_York':'Eastern Time · EST / EDT',
 'America/Los_Angeles':'Pacific Time · PST / PDT',
 'America/Anchorage':'Alaska Time · AKST / AKDT',
 'Pacific/Honolulu':'Hawaii Time · HST',
 'Europe/London':'UK Time · GMT / BST',
 'Europe/Istanbul':'Türkiye Time · TRT',
 'Asia/Bangkok':'Indochina Time · ICT'
};
const foldSearch=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const key='mgl-worldlight-cities-v1';
let selected=[...defaults];
try{selected=normalizeSelection(JSON.parse(localStorage.getItem(key)),CITIES,defaults);}catch{}
const canvas=$('#map'),ctx=canvas.getContext('2d'),background=document.createElement('canvas');
let w=0,h=0,backgroundKey='',layoutKey='',boxes=[],cards=[];
const formatters=new Map();
function formatter(zone,kind){
 const key=zone+kind;
 if(!formatters.has(key))formatters.set(key,new Intl.DateTimeFormat('en-US',kind==='parts'?{timeZone:zone,hour:'numeric',minute:'2-digit',second:'2-digit',hourCycle:'h23'}:kind==='date'?{timeZone:zone,weekday:'short',month:'short',day:'numeric'}:kind==='zone'?{timeZone:zone,timeZoneName:'short'}:{timeZone:zone,hour:'numeric',minute:'2-digit',hour12:true}));
 return formatters.get(key);
}
function rebuildCards(){
 const host=$('#clocks');host.replaceChildren();cards=[];
 for(const name of selected){
  const city=CITIES.find(c=>c.name===name),article=document.createElement('article');article.className='card';
  const face=document.createElement('canvas');face.className='face';face.width=216;face.height=216;face.setAttribute('aria-hidden','true');
  const heading=document.createElement('h2');heading.textContent=name;
  const time=document.createElement('div');time.className='time';
  const date=document.createElement('div');date.className='date';
  const state=document.createElement('div');state.className='state';
  article.append(face,heading,time,date,state);host.append(article);cards.push({city,face,time,date,state});
 }
 layoutKey='';tick();
}
function faceDraw(canvas,now,city,light){
 const c=canvas.getContext('2d'),parts=Object.fromEntries(formatter(city.zone,'parts').formatToParts(now).map(p=>[p.type,p.value]));
 c.clearRect(0,0,216,216);c.save();c.translate(108,108);
 c.beginPath();c.arc(0,0,103,0,Math.PI*2);c.fillStyle=light?'#f5f5f7':'#08090c';c.fill();c.strokeStyle=light?'#d2d2d6':'#4e5056';c.lineWidth=2;c.stroke();
 const ink=light?'#222224':'#f2f2f7';c.strokeStyle=ink;c.lineWidth=3;c.lineCap='round';
 for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(Math.sin(a)*84,-Math.cos(a)*84);c.lineTo(Math.sin(a)*95,-Math.cos(a)*95);c.stroke();}
 const sec=Number(parts.second),minute=Number(parts.minute)+sec/60,hour=Number(parts.hour)%12+minute/60;
 for(const [value,length,width,color] of [[hour/12,49,8,ink],[minute/60,73,6,ink],[sec/60,78,3,'#ff9f0a']]){const a=value*Math.PI*2;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(0,0);c.lineTo(Math.sin(a)*length,-Math.cos(a)*length);c.stroke();}
 c.fillStyle='#ff9f0a';c.beginPath();c.arc(0,0,5,0,Math.PI*2);c.fill();c.restore();
}
function drawBackground(now,vector){
 const stamp=[Math.floor(now.getTime()/60000),w,h].join(':');if(stamp===backgroundKey)return;backgroundKey=stamp;
 background.width=Math.round(w);background.height=Math.round(h);const c=background.getContext('2d');
 c.fillStyle='#222428';c.fillRect(0,0,w,h);c.strokeStyle='#34363c';c.lineWidth=.6;
 for(let lon=-150;lon<=150;lon+=30){const x=(lon+180)/360*w;c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
 c.fillStyle='#7d8086';for(const poly of LAND){c.beginPath();poly.forEach(([lon,lat],i)=>{const x=(lon+180)/360*w,y=(90-lat)/180*h;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.fill();}
 const shade=document.createElement('canvas');shade.width=360;shade.height=Math.max(180,Math.min(720,Math.round(360*h/w)));const sc=shade.getContext('2d'),pixels=sc.createImageData(shade.width,shade.height);
 for(let y=0;y<shade.height;y++)for(let x=0;x<shade.width;x++){const alt=altitude(vector,90-y*180/(shade.height-1),-180+x*360/(shade.width-1));let n=Math.max(0,Math.min(1,-alt/6));n=n*n*(3-2*n);pixels.data[(y*shade.width+x)*4+3]=Math.round(202*n);}
 sc.putImageData(pixels,0,0);c.drawImage(shade,0,0,w,h);
 const solarLon=Math.atan2(vector[1],vector[0]),horizontal=Math.hypot(vector[0],vector[1]);c.strokeStyle='#e1e5edb9';c.lineWidth=1;
 for(const side of [-1,1]){let connected=false,previousX=0;c.beginPath();for(let row=0;row<=h;row++){const lat=(89.999-row*179.998/h)*Math.PI/180,cosine=-Math.tan(lat)*vector[2]/horizontal;if(Math.abs(cosine)>1){connected=false;continue;}let lon=(solarLon+side*Math.acos(cosine))*180/Math.PI;lon=((lon+180)%360+360)%360-180;const x=(lon+180)/360*w;if(connected&&Math.abs(x-previousX)<w/2)c.lineTo(x,row);else c.moveTo(x,row);connected=true;previousX=x;}c.stroke();}
}
function roundedRectPath(c,x,y,width,height,radius=4){
 c.beginPath();
 if(typeof c.roundRect==='function'){c.roundRect(x,y,width,height,radius);return;}
 const r=Math.min(radius,width/2,height/2);
 c.moveTo(x+r,y);c.lineTo(x+width-r,y);c.quadraticCurveTo(x+width,y,x+width,y+r);c.lineTo(x+width,y+height-r);c.quadraticCurveTo(x+width,y+height,x+width-r,y+height);c.lineTo(x+r,y+height);c.quadraticCurveTo(x,y+height,x,y+height-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}
function drawMap(now,vector){
 if(!w||!h)return;drawBackground(now,vector);ctx.clearRect(0,0,w,h);ctx.drawImage(background,0,0,w,h);ctx.textAlign='left';
 const items=cards.map(({city})=>{const time=formatter(city.zone,'time').format(now);ctx.font='600 13px system-ui';const nameWidth=ctx.measureText(city.name).width;ctx.font='11px system-ui';return{city,time,x:(city.lon+180)/360*w,y:(90-city.lat)/180*h,w:Math.max(nameWidth,ctx.measureText(time).width)+8,h:34};});
 const stamp=JSON.stringify([w,h,items.map(i=>[i.city.name,i.w])]);if(stamp!==layoutKey){boxes=placeLabels(w,h,items);layoutKey=stamp;}
 ctx.strokeStyle='#c3ccdca0';ctx.lineWidth=.8;
 items.forEach((i,n)=>{const b=boxes[n];if(!b)return;ctx.beginPath();ctx.moveTo(i.x,i.y);ctx.lineTo(Math.max(b.x,Math.min(b.x+b.w,i.x)),Math.max(b.y,Math.min(b.y+b.h,i.y)));ctx.stroke();});
 items.forEach((i,n)=>{const b=boxes[n];if(b){ctx.fillStyle='#0c0e12df';roundedRectPath(ctx,b.x,b.y,b.w,b.h,4);ctx.fill();ctx.font='600 13px system-ui';ctx.fillStyle='#f2f2f7';ctx.fillText(i.city.name,b.x+4,b.y+14);ctx.font='11px system-ui';ctx.fillStyle='#bec0c8';ctx.fillText(i.time,b.x+4,b.y+28);}});
 items.forEach(i=>{ctx.fillStyle=altitude(vector,i.city.lat,i.city.lon)>=0?'#ff9f0a':'#78afff';ctx.strokeStyle='#090a0ccc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(i.x,i.y,4.5,0,Math.PI*2);ctx.fill();ctx.stroke();});
 $('#notice').textContent=boxes.some(b=>!b)?'Some map labels are hidden to avoid crowding. Every selected city is shown in the clocks below.':'';
}
function tick(){
 const now=new Date(),vector=solarVector(now);
 for(const card of cards){const a=altitude(vector,card.city.lat,card.city.lon),state=statusFor(a);const zone=formatter(card.city.zone,'zone').formatToParts(now).find(p=>p.type==='timeZoneName')?.value||'';
 card.time.textContent=formatter(card.city.zone,'time').format(now)+' '+zone;card.date.textContent=formatter(card.city.zone,'date').format(now);card.state.textContent=state;card.state.className='state '+state.toLowerCase();faceDraw(card.face,now,card.city,a>=0);}
 drawMap(now,vector);
}
new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();w=Math.round(rect.width);h=Math.round(rect.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);layoutKey='';tick();}).observe(canvas);
let draft=new Set(selected);const picker=$('#picker');
const choices=CITIES.map(city=>{const label=document.createElement('label');label.className='city-choice';const input=document.createElement('input');input.type='checkbox';input.value=city.name;const text=document.createElement('span');text.append(document.createTextNode(city.name));const detail=document.createElement('small');detail.textContent=zoneDetails[city.zone]||city.zone.replace(/_/g,' ');text.append(detail);label.append(input,text);$('#city-list').append(label);input.addEventListener('change',()=>{input.checked?draft.add(city.name):draft.delete(city.name);updateCount();});return{label,input,search:foldSearch(city.name+' '+detail.textContent+' '+city.zone)};});
function updateCount(){$('#count').textContent=draft.size+(draft.size===1?' city selected':' cities selected');$('#done').disabled=draft.size===0;}
$('#choose').addEventListener('click',()=>{draft=new Set(selected);for(const c of choices){c.input.checked=draft.has(c.input.value);c.label.hidden=false;c.label.style.display='';}$('#search').value='';$('#empty').hidden=true;updateCount();picker.showModal();$('#search').focus();});
$('#search').addEventListener('input',()=>{const q=foldSearch($('#search').value.trim());let found=0;for(const c of choices){const visible=c.search.includes(q);c.label.style.display=visible?'':'none';if(visible)found++;}$('#empty').hidden=found>0;});
for(const id of ['close','cancel'])$('#'+id).addEventListener('click',()=>picker.close());
$('#city-form').addEventListener('submit',event=>{event.preventDefault();if(!draft.size)return;selected=[...draft];try{localStorage.setItem(key,JSON.stringify(selected));}catch{}picker.close();rebuildCards();});
rebuildCards();setInterval(()=>{if(!document.hidden)tick();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
