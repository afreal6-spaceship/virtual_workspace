import type { Node, Edge, Viewport } from '@xyflow/react';

export const kinds = ['Application','Backend Service','Frontend Module','Database','API Endpoint','Microservice','External Integration','User / Actor','Data Source','Data Processing','Authentication','Approval Process','Notification','Monitoring','Deployment','Custom Component'] as const;
export const statuses = ['idle','pending','running','completed','failed','warning','disabled'] as const;
export const relations = {
  data: { label: 'Data Flow', color: '#f59264', dash: '7 5' },
  api: { label: 'API Integration', color: '#60a5fa', dash: '7 5' },
  dependency: { label: 'Dependency', color: '#a78bfa', dash: '3 5' },
  business: { label: 'Business Process', color: '#f59264', dash: '7 5' },
  approval: { label: 'Approval Flow', color: '#fbbf24', dash: '7 5' },
  event: { label: 'Event / Notification', color: '#4ade80', dash: '3 5' },
  database: { label: 'Database Connection', color: '#2dd4bf', dash: '' },
  error: { label: 'Error / Failure', color: '#9ca3af', dash: '7 5' },
} as const;
export type Relation = keyof typeof relations;
export type ComponentData = {
  name: string; kind: typeof kinds[number]; icon: string; description: string; category: string;
  background: string; border: string; status: typeof statuses[number]; inputs: string[]; outputs: string[];
  apiEndpoint: string; databaseModel: string; config: Record<string, unknown>; metadata: Record<string, unknown>;
  collapsed?: boolean;
};
export type ArchNode = Node<ComponentData, 'component' | 'section' | 'note'>;
export type ArchEdge = Edge<{ relationship: Relation; routing: 'smooth'|'straight'|'step'; animate: boolean; metadata: Record<string, unknown> }, 'relationship'>;
export type Architecture = { format: 'visual-workspace-architecture'; version: 1; title: string; nodes: ArchNode[]; edges: ArchEdge[]; viewport: Viewport; metadata: Record<string, unknown> };
export type Issue = { id: string; message: string; severity: 'error'|'warning'; nodeId?: string; edgeId?: string };
export const uid = () => crypto.randomUUID();
export const iconFor: Record<typeof kinds[number], string> = {'Application':'app-window','Backend Service':'server','Frontend Module':'panels-top-left','Database':'database','API Endpoint':'plug','Microservice':'boxes','External Integration':'network','User / Actor':'user','Data Source':'files','Data Processing':'workflow','Authentication':'shield-check','Approval Process':'badge-check','Notification':'bell','Monitoring':'activity','Deployment':'rocket','Custom Component':'component'};
export function nodeData(name = 'New component', kind: ComponentData['kind'] = 'Application'): ComponentData {
  return { name, kind, icon: iconFor[kind], description: '', category: kind, background: '', border: '#6c91ba', status: 'idle', inputs: ['in'], outputs: ['out'], apiEndpoint: '', databaseModel: '', config: {}, metadata: {} };
}
export function emptyArchitecture(title = 'System architecture'): Architecture {return {format:'visual-workspace-architecture',version:1,title,nodes:[],edges:[],viewport:{x:0,y:0,zoom:1},metadata:{}};}
export function edge(source:string,target:string,relationship:Relation='data',label=''):ArchEdge { return {id:uid(),source,target,sourceHandle:'out',targetHandle:'in',type:'relationship',label,data:{relationship,routing:'smooth',animate:false,metadata:{}}}; }
export function validateGraph(a:Architecture):Issue[] {
  const issues:Issue[]=[];const add=(message:string,nodeId?:string,edgeId?:string,severity:Issue['severity']='warning')=>issues.push({id:String(issues.length),message,nodeId,edgeId,severity});
  const ids=new Set<string>(),names=new Map<string,string>();
  for(const n of a.nodes){if(ids.has(n.id))add('Duplicate ID',n.id,undefined,'error');ids.add(n.id);if(names.has(n.data.name.toLowerCase()))add('Duplicate component name',n.id);names.set(n.data.name.toLowerCase(),n.id);}
  const map=new Map(a.nodes.map(n=>[n.id,n]));const incoming=new Map<string,string[]>(),outgoing=new Map<string,string[]>();
  for(const e of a.edges){const s=map.get(e.source),t=map.get(e.target);if(!s||!t){add('Connection endpoint is missing',undefined,e.id,'error');continue;}
    if(!s.data.outputs.includes(e.sourceHandle||'out')||!t.data.inputs.includes(e.targetHandle||'in'))add('Connection handle is missing',e.source,e.id,'error');
    if(e.source===e.target)add('Self connection',e.source,e.id,'error');
    incoming.set(e.target,[...(incoming.get(e.target)||[]),e.source]);outgoing.set(e.source,[...(outgoing.get(e.source)||[]),e.target]);
  }
  const components=a.nodes.filter(n=>n.type==='component');
  for(const n of components){if(!incoming.has(n.id)&&!outgoing.has(n.id))add('Disconnected component',n.id);
    if(n.data.config.requiresInput===true&&!incoming.has(n.id))add('Required input has no connection',n.id,undefined,'error');
    if(n.data.apiEndpoint&&!a.edges.some(e=>(e.source===n.id||e.target===n.id)&&e.data?.relationship==='api'))add('API endpoint has no API relationship',n.id);
  }
  const deps=new Map<string,string[]>();for(const e of a.edges)if(e.data?.relationship==='dependency')deps.set(e.source,[...(deps.get(e.source)||[]),e.target]);
  const visiting=new Set<string>(),done=new Set<string>();function visit(id:string){if(visiting.has(id)){add('Circular dependency',id,undefined,'error');return;}if(done.has(id))return;visiting.add(id);for(const next of deps.get(id)||[])visit(next);visiting.delete(id);done.add(id);}for(const n of components)visit(n.id);
  const roots=components.filter(n=>n.data.kind==='User / Actor'||n.data.kind==='Data Source'||n.data.metadata.entry===true);
  if(components.length&&!roots.length)add('No actor, data source, or entry point is defined');
  const reached=new Set<string>(),queue=roots.map(n=>n.id);while(queue.length){const id=queue.shift()!;if(reached.has(id))continue;reached.add(id);queue.push(...(outgoing.get(id)||[]));}
  if(roots.length)for(const n of components)if(!reached.has(n.id))add('Unreachable from an entry point',n.id);
  for(const name of Array.isArray(a.metadata.requiredModules)?a.metadata.requiredModules:[])if(!a.nodes.some(n=>n.type==='section'&&n.data.name===name))add(`Required module missing: ${name}`);
  return issues;
}
export function parseArchitecture(raw:unknown):Architecture {
  if(!raw||typeof raw!=='object')throw Error('Expected architecture JSON');const a=raw as Architecture;
  if(a.format!=='visual-workspace-architecture'||a.version!==1||!Array.isArray(a.nodes)||!Array.isArray(a.edges))throw Error('Unsupported architecture format or version');
  if(a.nodes.length>2000||a.edges.length>10000)throw Error('Architecture exceeds 2,000 nodes or 10,000 connections');
  const ids=new Set<string>();for(const n of a.nodes){if(typeof n.id!=='string'||ids.has(n.id))throw Error('Invalid or duplicate node ID');ids.add(n.id);if(!['component','section','note'].includes(n.type||'')||!n.data||typeof n.data.name!=='string'||!kinds.includes(n.data.kind)||!statuses.includes(n.data.status)||!Number.isFinite(n.position?.x)||!Number.isFinite(n.position?.y))throw Error('Invalid node');if(!Array.isArray(n.data.inputs)||!Array.isArray(n.data.outputs)||![...n.data.inputs,...n.data.outputs].every(v=>typeof v==='string'&&v.length>0))throw Error('Invalid handles');}
  for(const n of a.nodes)if(n.parentId&&!a.nodes.some(p=>p.id===n.parentId&&p.type==='section'&&!p.parentId))throw Error('Parent must be a top-level section');
  const eids=new Set<string>();for(const e of a.edges){if(!e.id||eids.has(e.id)||!ids.has(e.source)||!ids.has(e.target)||!e.data||!(e.data.relationship in relations)||!['smooth','step','straight'].includes(e.data.routing))throw Error('Invalid edge');eids.add(e.id);if(!a.nodes.find(n=>n.id===e.source)!.data.outputs.includes(e.sourceHandle||'out')||!a.nodes.find(n=>n.id===e.target)!.data.inputs.includes(e.targetHandle||'in'))throw Error('Invalid edge handle');}
  if(!a.viewport||![a.viewport.x,a.viewport.y,a.viewport.zoom].every(Number.isFinite)||a.viewport.zoom<=0)throw Error('Invalid viewport');
  return {...a,nodes:[...a.nodes.filter(n=>!n.parentId),...a.nodes.filter(n=>n.parentId)],metadata:a.metadata||{}};
}
export function documentation(a:Architecture):string {return [`# ${a.title}`,'','## Components',...a.nodes.map(n=>`- **${n.data.name}** (${n.type==='section'?'Module':n.data.kind}): ${n.data.description||'No description'}`),'','## Relationships',...a.edges.map(e=>`- ${a.nodes.find(n=>n.id===e.source)?.data.name} → ${a.nodes.find(n=>n.id===e.target)?.data.name}: ${relations[e.data!.relationship].label} — ${e.label||''}`),'','## Validation',...validateGraph(a).map(i=>`- ${i.severity}: ${i.message}`)].join('\n');}
