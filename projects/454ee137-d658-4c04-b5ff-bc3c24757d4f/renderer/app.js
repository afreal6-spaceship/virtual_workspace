const svg=document.querySelector('#diagram'),initial=JSON.parse(JSON.stringify(DATA.layout));
let layout=DATA.layout,drag=null,zoom=1;
document.querySelector('#title').textContent=DATA.spec.title;document.title=DATA.spec.title;
function draw(fit=false){const rendered=Workflow.render(DATA.spec,layout,DATA.icons);svg.innerHTML=rendered.content;if(fit)svg.setAttribute('viewBox',rendered.box.join(' '));}
function location(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
function getNode(id){for(const m of layout.children){if(m.id===id)return {node:m};const n=m.children?.find(n=>n.id===id);if(n)return {node:n,parent:m};}}
function move(id,dx,dy){const {node,parent}=getNode(id);node.x+=dx;node.y+=dy;if(parent){node.x=Math.max(14,Math.min(parent.width-node.width-14,node.x));node.y=Math.max(50,Math.min(parent.height-node.height-18,node.y));}draw();}
svg.addEventListener('pointerdown',event=>{const target=event.target.closest('[data-id]');if(!target)return;const p=location(event);drag={id:target.dataset.id,x:p.x,y:p.y};svg.setPointerCapture(event.pointerId);});
svg.addEventListener('pointermove',event=>{if(!drag)return;const p=location(event);move(drag.id,p.x-drag.x,p.y-drag.y);drag.x=p.x;drag.y=p.y;});
function finish(){if(drag){document.querySelector('#status').textContent='Moved '+drag.id+' · connectors remain bound · layout is session-only';drag=null;}}
svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
svg.addEventListener('keydown',event=>{const target=event.target.closest('[data-id]'),delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[event.key];if(target&&delta){event.preventDefault();const id=target.dataset.id;move(id,...delta);svg.querySelector(`[data-id="${id}"]`).focus();}});
document.querySelector('#pause').onclick=event=>{const paused=document.body.classList.toggle('paused');event.target.textContent=paused?'Play animation':'Pause animation';event.target.setAttribute('aria-pressed',String(paused));};
document.querySelector('#reset').onclick=()=>{layout=JSON.parse(JSON.stringify(initial));draw(true);zoom=1;svg.style.width='100%';svg.style.height='100%';};
function resize(factor){zoom=Math.max(.5,Math.min(4,zoom*factor));svg.style.width=100*zoom+'%';svg.style.height=100*zoom+'%';}
document.querySelector('#zoom-in').onclick=()=>resize(1.25);document.querySelector('#zoom-out').onclick=()=>resize(.8);
window.workflowTest={get layout(){return layout;},move,draw};
