const rad = Math.PI / 180;
export function solarVector(date) {
  const n = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  const hour = date.getUTCHours() + date.getUTCMinutes()/60 + date.getUTCSeconds()/3600;
  const g = 2*Math.PI/365*(n-1+(hour-12)/24);
  const eq = 229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
  const decl = .006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const longitude = (180-hour*15-eq/4)*rad;
  return [Math.cos(decl)*Math.cos(longitude), Math.cos(decl)*Math.sin(longitude), Math.sin(decl)];
}
export function altitude(vector, lat, lon) {
  const cl=Math.cos(lat*rad), sl=Math.sin(lat*rad);
  return Math.asin(Math.max(-1,Math.min(1,cl*(vector[0]*Math.cos(lon*rad)+vector[1]*Math.sin(lon*rad))+sl*vector[2])))/rad;
}
export const statusFor = a => a>=0 ? 'Daylight' : a>-6 ? 'Twilight' : 'Night';
export function normalizeSelection(value, cities, defaults) {
  if(!Array.isArray(value)) return [...defaults];
  const result=[...new Set(value.filter(name=>cities.some(c=>c.name===name)))];
  return result.length ? result : [...defaults];
}
export const intersects = (a,b,gap=4) => a.x<b.x+b.w+gap && a.x+a.w+gap>b.x && a.y<b.y+b.h+gap && a.y+a.h+gap>b.y;
export function placeLabels(width,height,items) {
  const placed=[];
  for(const item of items) {
    let best=null, score=Infinity;
    for(let offset=0;offset<height;offset+=4) for(const direction of [-1,1]) for(const side of [1,-1]) {
      const y=Math.max(4,Math.min(height-4-item.h,item.y-item.h/2+direction*offset));
      const x=Math.max(4,Math.min(width-4-item.w,side===1?item.x+9:item.x-9-item.w));
      const box={x,y,w:item.w,h:item.h};
      if(x<4||y<4||x+item.w>width-4||y+item.h>height-4)continue;
      if(placed.some(p=>p&&intersects(box,p)))continue;
      if(items.some(p=>p.x+6>x&&p.x-6<x+item.w&&p.y+6>y&&p.y-6<y+item.h))continue;
      const dx=Math.max(x-item.x,0,item.x-x-item.w),dy=y+item.h/2-item.y;
      const cost=dx*dx+dy*dy+(side===1?0:1);
      if(cost<score){score=cost;best=box;}
    }
    placed.push(best);
  }
  return placed;
}
