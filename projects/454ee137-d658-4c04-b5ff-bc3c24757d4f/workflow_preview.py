"""Dependency-free, offline SVG workflow preview; animation represents simulated flow."""
import html
import json


def render_preview(board, path):
    escape = html.escape
    nodes = {n['id']: n for n in board['nodes']}
    colors = {'blue': '#76b7ff', 'green': '#69d7af', 'yellow': '#ffd17c',
              'purple': '#be9aff', 'red': '#ff947d'}
    parts = []
    for group in board.get('groups', []):
        parts.append(f'<rect class="group" x="{group["x"]}" y="{group["y"]}" width="{group["w"]}" height="{group["h"]}" rx="20"/>')
        parts.append(f'<text class="group-title" x="{group["x"]+20}" y="{group["y"]+30}">{escape(group["title"])}</text>')
    for i, edge in enumerate(board['arrows']):
        a, b = nodes[edge['from']], nodes[edge['to']]
        color = colors.get(edge.get('color', a['color']), '#76b7ff')
        if a['y'] == b['y'] and b['x']-a['x'] == 340:
            forward = b['x'] > a['x']
            x1, x2 = a['x'] + (a['w'] if forward else 0), b['x'] + (0 if forward else b['w'])
            y = a['y'] + 65
            d = f'M{x1},{y} H{x2}'
            tx, ty = (x1+x2)/2, y-12
        elif a['y'] == b['y']:
            x1, x2 = a['x']+a['w']/2, b['x']+b['w']/2
            y = a['y']+a['h']
            lane = y+18+(i % 3)*13
            d = f'M{x1},{y} V{lane} H{x2} V{y}'
            tx, ty = (x1+x2)/2, lane-5
        else:
            # Cross-module transfers use dedicated side gutters to avoid node interiors.
            x1, x2 = a['x']+a['w']/2, b['x']+b['w']/2
            y1, y2 = a['y']+a['h'], b['y']
            gutter = 1460 + i*9
            d = f'M{x1},{y1} V{y1+22} H{gutter} V{y2-18} H{x2} V{y2}'
            tx, ty = gutter+8, (y1+y2)/2
        parts.append(f'<g class="edge" data-from="{escape(a["id"])}" data-to="{escape(b["id"])}"><path id="edge{i}" d="{d}" stroke="{color}" marker-end="url(#arrow)"/><text x="{tx}" y="{ty}" fill="{color}">{escape(edge["label"])}</text></g>')
    for n in nodes.values():
        color = colors.get(n['color'], '#76b7ff')
        parts.append(f'<g class="node" tabindex="0" role="button" aria-label="{escape(n["title"], quote=True)}" data-id="{escape(n["id"])}" transform="translate({n["x"]},{n["y"]})"><rect width="{n["w"]}" height="{n["h"]}" rx="14" stroke="{color}"/><text class="icon" x="{n["w"]/2}" y="48">{escape(n["icon"])}</text><text class="title" x="{n["w"]/2}" y="80">{escape(n["title"])}</text><text class="subtitle" x="{n["w"]/2}" y="104">{escape(n["subtitle"])}</text></g>')
    payload = json.dumps(board, ensure_ascii=False).replace('<', '\\u003c')
    document = '''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>HRMS · Workflow explorer</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101214;color:#eef1f5}body{margin:0}header{padding:28px 32px 18px;border-bottom:1px solid #333}h1{font-size:28px;margin:6px 0}p{color:#adb5c0;line-height:1.6;margin:8px 0}.eyebrow{color:#69d7af;font-size:12px;letter-spacing:2px}button,select{background:#20262e;color:#eef1f5;border:1px solid #576171;border-radius:7px;padding:9px 14px;font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #76b7ff}.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:16px}.badge{color:#ffd17c;font-size:13px}.canvas{overflow:auto;padding:20px}svg{width:100%;min-width:1080px;display:block}.group{fill:#15191d;stroke:#626970;stroke-dasharray:3 5}.group-title{fill:#e6e9ed;font-size:21px;font-weight:600}.node{cursor:pointer}.node rect{fill:#1b2128;stroke-opacity:.6}.node:hover rect,.node:focus rect,.node.selected rect{fill:#2b3541;stroke-width:3;stroke-opacity:1}.node text{text-anchor:middle;pointer-events:none;fill:#eef1f5}.node .icon{font-size:36px}.node .title{font-size:16px;font-weight:600}.node .subtitle{font-size:12px;fill:#aab5c1}.edge path{fill:none;stroke-width:2;stroke-dasharray:7 7;animation:flow 1.1s linear infinite}.edge text{font-size:10px;paint-order:stroke;stroke:#101214;stroke-width:4px;stroke-linejoin:round}.edge.dim{opacity:.09}.paused .edge path{animation-play-state:paused}@keyframes flow{to{stroke-dashoffset:-28}}aside{margin:0 32px 30px;padding:20px;border:1px solid #414953;border-radius:12px}aside h2{margin:0;font-size:19px}li{line-height:1.8;color:#c2cad4}.legend{font-size:13px}.legend span{margin-right:18px}@media(prefers-reduced-motion:reduce){.edge path{animation:none}}@media print{.toolbar{display:none}svg{min-width:0}.canvas{padding:0}header,aside{break-inside:avoid}}
</style>
<header><div class="eyebrow">PEOPLE OPERATIONS / SYSTEM MAP</div><h1>HRMS project workflow</h1><p>From candidate to employee, payroll, development and exit. Select an icon to inspect its data transfers.</p><div class="legend"><span style="color:#76b7ff">● Hiring</span><span style="color:#69d7af">● People & time</span><span style="color:#ffd17c">● Payroll</span><span style="color:#be9aff">● Learning & knowledge</span><span style="color:#ff947d">● Exit & audit</span></div><div class="toolbar"><button id="play" aria-pressed="true">Pause animation</button><button id="reset">Show all flows</button><label>Module <select id="module"><option value="">All modules</option></select></label><span class="badge">● Simulated flow · No live HRMS connection</span></div></header>
<main><div class="canvas"><svg viewBox="0 0 1950 1240" role="img" aria-label="HRMS workflow with grouped modules and directional data transfers"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#9babbc"/></marker></defs>__SVG__</svg></div><aside aria-live="polite"><h2 id="detail-title">Explore the workflow</h2><p id="detail">Choose a module to see the records it receives and sends. Dashed arrows show direction, not real transactions.</p><ul id="transfers"></ul></aside></main>
<script>
const board=__DATA__, select=document.querySelector('#module');
for(const n of board.nodes){const option=document.createElement('option');option.value=n.id;option.textContent=n.title;select.append(option)}
function focusNode(id){const n=board.nodes.find(n=>n.id===id);select.value=id;document.querySelectorAll('.node').forEach(el=>el.classList.toggle('selected',el.dataset.id===id));document.querySelectorAll('.edge').forEach(el=>el.classList.toggle('dim',!!id&&el.dataset.from!==id&&el.dataset.to!==id));document.querySelector('#detail-title').textContent=n?n.icon+' '+n.title:'Explore the workflow';document.querySelector('#detail').textContent=n?n.description:'Choose a module to see the records it receives and sends. Dashed arrows show direction, not real transactions.';const list=document.querySelector('#transfers');list.replaceChildren();if(n)for(const e of board.arrows.filter(e=>e.from===id||e.to===id)){const li=document.createElement('li');const source=board.nodes.find(n=>n.id===e.from),target=board.nodes.find(n=>n.id===e.to);li.textContent=source.title+' → '+target.title+': '+e.label;list.append(li)}}
document.querySelectorAll('.node').forEach(el=>{el.addEventListener('click',()=>focusNode(el.dataset.id));el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();focusNode(el.dataset.id)}})});
select.addEventListener('change',()=>focusNode(select.value));document.querySelector('#reset').onclick=()=>focusNode('');document.querySelector('#play').onclick=event=>{const paused=document.body.classList.toggle('paused');event.target.textContent=paused?'Play animation':'Pause animation';event.target.setAttribute('aria-pressed',String(!paused))};
</script></html>'''
    path.write_text(document.replace('__SVG__', ''.join(parts)).replace('__DATA__', payload), encoding='utf-8')
