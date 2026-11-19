import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { emptyArchitecture, nodeData, edge, type Architecture, type Relation } from './model';
const elk=new ELK();
export async function arrange(a:Architecture):Promise<Architecture>{
  const nodes=a.nodes.map(n=>({...n,position:{...n.position},style:{...n.style}}));
  const groups=nodes.filter(n=>n.type==='section');
  for(const g of groups){const children=nodes.filter(n=>n.parentId===g.id),ids=new Set(children.map(n=>n.id));if(!children.length)continue;
    const l:ElkNode=await elk.layout({id:g.id,layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.spacing.nodeNode':'40','elk.layered.spacing.nodeNodeBetweenLayers':'70','elk.padding':'[top=76,left=28,bottom=32,right=28]'},children:children.map(n=>({id:n.id,width:240,height:132})),edges:a.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)&&e.data?.relationship!=='error').map(e=>({id:e.id,sources:[e.source],targets:[e.target]}))});
    g.style={...g.style,width:l.width,height:l.height};g.width=l.width;g.height=l.height;for(const c of l.children||[]){const n=nodes.find(n=>n.id===c.id)!;n.position={x:c.x||0,y:c.y||0};}
  }
  const owner=new Map(nodes.map(n=>[n.id,n.parentId||n.id]));
  const l:ElkNode=await elk.layout({id:'architecture',layoutOptions:{'elk.algorithm':'layered','elk.direction':'DOWN','elk.spacing.nodeNode':'90','elk.layered.spacing.nodeNodeBetweenLayers':'150'},children:nodes.filter(n=>!n.parentId).map(n=>({id:n.id,width:Number(n.style?.width)||240,height:Number(n.style?.height)||132})),edges:a.edges.filter(e=>e.data?.relationship!=='error'&&owner.get(e.source)!==owner.get(e.target)).map(e=>({id:e.id,sources:[owner.get(e.source)!],targets:[owner.get(e.target)!]}))});
  for(const c of l.children||[]){const n=nodes.find(n=>n.id===c.id)!;n.position={x:c.x||0,y:c.y||0};}
  return {...a,nodes};
}
export async function fromSemantic(raw:any):Promise<Architecture>{
  if(raw?.version!==3||!Array.isArray(raw.modules))throw Error('Expected semantic workflow v3');
  const a=emptyArchitecture(raw.title);for(const m of raw.modules){a.nodes.push({id:m.id,type:'section',position:{x:0,y:0},style:{width:900,height:240},data:nodeData(m.title)});for(const s of m.steps){a.nodes.push({id:s.id,type:'component',parentId:m.id,extent:'parent',position:{x:0,y:0},data:{...nodeData(s.label,'Backend Service'),icon:s.icon||'server',description:s.description||''}});}m.steps.slice(1).forEach((s:any,i:number)=>a.edges.push(edge(m.steps[i].id,s.id,'api')));}
  for(const actor of raw.actors||[])a.nodes.push({id:actor.id,type:'component',position:{x:0,y:0},data:{...nodeData(actor.label,'User / Actor'),icon:actor.icon}});
  const types:Record<string,Relation>={main:'business',seq:'api',feedback:'error',output:'event'};
  for(const f of raw.flows||[])a.edges.push(edge(f.from,f.to,types[f.type]||'data',f.label));
  return arrange(a);
}
export async function hrmsArchitecture():Promise<Architecture>{
  const a=emptyArchitecture('HRMS · People operations');
  const definitions:[string,string,[string,string,Parameters<typeof nodeData>[1]][]][]=[
    ['recruitment','Recruitment Management',[['requisition','Approve requisition','Approval Process'],['candidates','Assess applicants','Application'],['offer','Accept offer','Approval Process']]],
    ['employees','Employee Management',[['onboard','Onboard employee','Application'],['master','Employee master','Database'],['identity','Provision access','Authentication']]],
    ['attendance','Attendance Management',[['clock','Capture time','Data Source'],['timesheet','Reconcile timesheet','Data Processing'],['approveTime','Approve period','Approval Process']]],
    ['leave','Leave Management',[['leaveRequest','Leave request','Frontend Module'],['manager','Manager approval','Approval Process'],['balance','Update leave balance','Database']]],
    ['payroll','Payroll Management',[['salary','Calculate payroll','Data Processing'],['payrollReview','Approve payroll','Approval Process'],['payslip','Generate payslip','Backend Service']]],
    ['banking','Finance and Banking',[['bankApi','Bank payment API','API Endpoint'],['reconcile','Reconcile payment','Data Processing'],['ledger','Finance ledger','Database']]],
    ['performance','Performance Management',[['goals','Set objectives','Application'],['review','Review performance','Approval Process'],['skills','Identify skill gaps','Data Processing']]],
    ['training','Training and Knowledge Management',[['courses','Assign courses','Application'],['assessment','Assess learning','Approval Process'],['knowledge','Knowledge base','Database']]],
    ['selfservice','Employee Self-Service',[['portal','Employee portal','Frontend Module'],['documents','View documents','Application'],['notifications','Notify employee','Notification']]],
    ['reporting','Reporting and Audit',[['events','Collect audit events','Monitoring'],['reports','HR reporting','Data Processing'],['dashboard','Insights dashboard','Application']]],
  ];
  for(const [id,title,steps] of definitions){a.nodes.push({id,type:'section',position:{x:0,y:0},style:{width:900,height:260},data:{...nodeData(title),description:'HRMS module',border:'#58738b'}});steps.forEach(([sid,name,kind])=>a.nodes.push({id:sid,type:'component',parentId:id,extent:'parent',position:{x:0,y:0},data:nodeData(name,kind)}));for(let i=1;i<steps.length;i++)a.edges.push(edge(steps[i-1][0],steps[i][0],'business','Validated record'));}
  a.nodes.unshift({id:'employee',type:'component',position:{x:0,y:0},data:nodeData('Employee','User / Actor')},{id:'hrteam',type:'component',position:{x:0,y:0},data:nodeData('HR team','User / Actor')});
  const flows:[string,string,Relation,string][]=[['hrteam','requisition','approval','Headcount'],['offer','onboard','business','Accepted offer'],['master','clock','data','Employee schedule'],['master','goals','data','Role & objectives'],['master','salary','data','Compensation terms'],['employee','leaveRequest','business','Leave application'],['balance','timesheet','data','Approved leave'],['approveTime','salary','data','Payable days'],['payrollReview','bankApi','api','Approved payment'],['bankApi','payrollReview','error','Payment failed'],['payrollReview','salary','error','Correction required'],['ledger','events','event','Payment recorded'],['payslip','portal','data','Published payslip'],['employee','portal','api','Authenticated request'],['skills','courses','business','Development plan'],['knowledge','portal','data','Policies & guides'],['knowledge','review','error','Learning feedback'],['notifications','events','event','Delivery receipt'],['identity','portal','dependency','Identity provider']];
  for(const f of flows)a.edges.push(edge(...f));a.nodes.find(n=>n.id==='bankApi')!.data.apiEndpoint='/integrations/bank/payments';a.metadata={requiredModules:definitions.map(d=>d[1]),source:'Built-in HRMS architecture template',simulationPath:['employee','leaveRequest','manager','balance','timesheet','approveTime','salary','payrollReview']};
  return arrange(a);
}
