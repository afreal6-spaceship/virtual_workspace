const fs=require('fs'),path=require('path'),ELK=require('../vendor/elk.bundled.js'),engine=require('./engine.js');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
async function build(){
 const spec=JSON.parse(read('workflow.spec.json')),elk=new ELK();
 const children=[];
 for(const m of spec.modules){
  const internal=await elk.layout({id:m.id,layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.spacing.nodeNode':'42','elk.layered.spacing.nodeNodeBetweenLayers':'42','elk.padding':'[top=62,left=26,bottom=42,right=26]'},children:m.steps.map(s=>({id:s.id,width:138,height:108})),edges:m.steps.slice(1).map((s,i)=>({id:`seq-${m.id}-${i}`,sources:[m.steps[i].id],targets:[s.id]}))});children.push(internal);
 }
 for(const a of spec.actors)children.push({id:a.id,width:138,height:108});
 const owner=Object.fromEntries(spec.modules.flatMap(m=>m.steps.map(s=>[s.id,m.id])));
 const edges=spec.flows.filter(f=>f.type==='main'||f.type==='output').map((f,i)=>({id:'layout-'+i,sources:[owner[f.from]||f.from],targets:[owner[f.to]||f.to]})).filter(e=>e.sources[0]!==e.targets[0]);
 // Hierarchical layout: ELK child layouts become compound node dimensions for the outer pass.
 const outer=await elk.layout({id:'workflow',layoutOptions:{'elk.algorithm':'layered','elk.direction':'DOWN','elk.edgeRouting':'ORTHOGONAL','elk.layered.spacing.nodeNodeBetweenLayers':'130','elk.spacing.nodeNode':'100','elk.padding':'[top=40,left=40,bottom=40,right=40]'},children:children.map(n=>({id:n.id,width:n.width,height:n.height})),edges});
 outer.children=outer.children.map(n=>({...n,children:children.find(c=>c.id===n.id).children}));
 // Stagger within rank while preserving downward main flow and avoiding overlap.
 const ranks=[...new Set(outer.children.map(n=>n.y))].sort((a,b)=>a-b);
 outer.children.forEach(n=>{n.x+=(ranks.indexOf(n.y)%2)*55;});
 const icons={};for(const item of [...spec.actors,...spec.modules.flatMap(m=>m.steps)])icons[item.icon]=read('vendor/lucide/'+item.icon+'.svg').replace(/<\?xml[^>]*>|<!--[\s\S]*?-->/g,'');
 fs.writeFileSync(path.join(root,'workflow.layout.json'),JSON.stringify(outer,null,2));
 const {content,box}=engine.render(spec,outer,icons);
 const css=read('renderer/style.css');
 fs.writeFileSync(path.join(root,'workflow.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" style="background:#101214;font-family:system-ui"><style>${css}</style>${content}</svg>`);
 const data=JSON.stringify({spec,layout:outer,icons}).replace(/</g,'\\u003c');
 const html=read('renderer/page.html').replace('__STYLE__',css).replace('__SVG__',content).replace('__VIEWBOX__',box.join(' ')).replace('__DATA__',data).replace('__ENGINE__',read('renderer/engine.js')).replace('__APP__',read('renderer/app.js'));
 fs.writeFileSync(path.join(root,'workflow.html'),html);
}
build().catch(e=>{console.error(e);process.exit(1)});
