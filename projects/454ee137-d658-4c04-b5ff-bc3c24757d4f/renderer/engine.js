/* Shared by Node export and the browser; geometry never enters the semantic spec. */
(function(root){
const colors={main:'#fb9062',seq:'#7db8ff',feedback:'#929ba7',output:'#72cc95'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function flows(spec){return [...spec.flows,...spec.modules.flatMap(m=>m.steps.slice(1).map((s,i)=>({from:m.steps[i].id,to:s.id,type:'seq',label:''})))];}
function shapes(layout){const map={};for(const m of layout.children){map[m.id]=m;for(const s of m.children||[])map[s.id]={...s,x:m.x+s.x,y:m.y+s.y,parent:m};}return map;}
function route(f,map,index,bounds){
 const a=map[f.from],b=map[f.to];let points;
 if(f.type==='seq'){
  const start=[a.x+a.width,a.y+a.height/2],end=[b.x,b.y+b.height/2],mid=(start[0]+end[0])/2;
  points=[start,[mid,start[1]],[mid,end[1]],end];
 }else if(f.type==='feedback'){
  const lane=bounds.right+40+index*19;
  const start=[a.x+a.width/2,a.y+a.height],end=[b.x+b.width/2,b.y+b.height];
  const ay=a.parent?a.parent.y+a.parent.height-16:start[1]+20;
  const by=b.parent?b.parent.y+b.parent.height-16:end[1]+20;
  points=[start,[start[0],ay],[lane,ay],[lane,by],[end[0],by],end];
 }else{
  const down=b.y>a.y;
  const start=[a.x+a.width/2,a.y+a.height],end=[b.x+b.width/2,b.y];
  const ay=a.parent?a.parent.y+a.parent.height+18:start[1]+18;
  const by=b.parent?b.parent.y-18:end[1]-18;
  if(down){const mid=(ay+by)/2;points=[start,[start[0],mid],[end[0],mid],end];}
  else {const lane=bounds.left-35-index*14;points=[start,[start[0],ay],[lane,ay],[lane,by],[end[0],by],end];}
 }
 return {points,d:points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')};
}
function render(spec,layout,icons){
 const map=shapes(layout),fs=flows(spec),bounds={left:Math.min(...layout.children.map(n=>n.x)),right:Math.max(...layout.children.map(n=>n.x+n.width))};
 let content='<defs>'+Object.entries(colors).map(([t,c])=>`<marker id="end-${t}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${c}"/></marker>`).join('')+'</defs>';
 for(const m of spec.modules){const n=map[m.id];content+=`<g class="module" data-id="${m.id}" tabindex="0" role="button" aria-label="Move ${esc(m.title)}" transform="translate(${n.x},${n.y})"><rect width="${n.width}" height="${n.height}" rx="20" fill="#141719" stroke="#73787d" stroke-dasharray="3 5"/><text x="22" y="32" fill="#f3f3f1" font-size="20" font-weight="600">${esc(m.title)}</text></g>`;}
 const allPoints=[];
 fs.forEach((f,i)=>{const {points,d}=route(f,map,i,bounds);allPoints.push(...points);const c=colors[f.type],p=points[0];const mid=points[Math.floor(points.length/2)];content+=`<g class="flow" data-from="${f.from}" data-to="${f.to}" data-type="${f.type}"><title>${esc(f.label||'Next step')}</title><path class="flow-line" d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="7 7" marker-end="url(#end-${f.type})"/><circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${c}"/><text class="flow-label" x="${mid[0]+7}" y="${mid[1]-9}" fill="${c}" font-size="11" paint-order="stroke" stroke="#101214" stroke-width="4">${esc(f.label)}</text></g>`;});
 const all=[...spec.actors,...spec.modules.flatMap(m=>m.steps)];
 all.forEach((s,i)=>{const n=map[s.id],c=['#7db8ff','#be9bfa','#72cc95','#fbba78'][i%4];let icon=icons[s.icon].replace(/<svg[^>]*>/,`<svg x="${n.width/2-24}" y="8" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">`);const words=s.label.split(' '),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>21)lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}content+=`<g class="step" data-id="${s.id}" tabindex="0" role="button" aria-label="${esc(s.label)}" transform="translate(${n.x},${n.y})"><title>${esc(s.label)} · Drag to move</title><rect class="hit" width="${n.width}" height="${n.height}" rx="10" fill="#141719" fill-opacity="0.9"/>${icon}<text x="${n.width/2}" y="78" fill="#e8e9e7" text-anchor="middle" font-size="14">${lines.map((l,j)=>`<tspan x="${n.width/2}" dy="${j?17:0}">${esc(l)}</tspan>`).join('')}</text></g>`;});
 const xs=[...allPoints.map(p=>p[0]),...layout.children.flatMap(n=>[n.x,n.x+n.width])],ys=[...allPoints.map(p=>p[1]),...layout.children.flatMap(n=>[n.y,n.y+n.height])];
 const box=[Math.min(...xs)-35,Math.min(...ys)-35,Math.max(...xs)-Math.min(...xs)+230,Math.max(...ys)-Math.min(...ys)+70];
 return {content,box};
}
root.Workflow={render,flows,shapes};if(typeof module!=='undefined')module.exports=root.Workflow;
})(typeof window==='undefined'?globalThis:window);
