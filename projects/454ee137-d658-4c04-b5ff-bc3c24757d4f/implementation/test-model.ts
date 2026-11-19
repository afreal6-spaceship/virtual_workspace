import assert from 'node:assert/strict';
import { emptyArchitecture, nodeData, edge, parseArchitecture, validateGraph } from './frontend/src/features/architecture/model';
import { hrmsArchitecture, fromSemantic } from './frontend/src/features/architecture/layout';
import { readFileSync } from 'node:fs';
const a=await hrmsArchitecture();assert.equal(a.nodes.filter(n=>n.type==='section').length,10);assert.equal(a.nodes.length,42);assert.equal(parseArchitecture(JSON.parse(JSON.stringify(a))).edges.length,a.edges.length);assert.equal(validateGraph(a).filter(i=>i.severity==='error').length,0);
for(const n of a.nodes){assert(Number.isFinite(n.position.x));if(n.parentId)assert(a.nodes.find(p=>p.id===n.parentId));}
const invalid=structuredClone(a);invalid.edges[0].target='missing';assert.throws(()=>parseArchitecture(invalid));
const cycle=emptyArchitecture();cycle.nodes=['a','b'].map(id=>({id,type:'component',position:{x:0,y:0},data:nodeData(id)}));cycle.edges=[edge('a','b','dependency'),edge('b','a','dependency')];assert(validateGraph(cycle).some(i=>i.message==='Circular dependency'));
const big=emptyArchitecture('500 nodes');big.nodes=Array.from({length:500},(_,i)=>({id:'n'+i,type:'component',position:{x:i*250,y:0},data:nodeData('Node '+i)}));big.edges=big.nodes.slice(1).map((n,i)=>edge('n'+i,n.id));const begin=performance.now();parseArchitecture(big);validateGraph(big);console.log('500 node validation ms:',performance.now()-begin);
const sem=JSON.parse(readFileSync('templates/hrms.json','utf8'));const result=await fromSemantic(sem);assert(result.nodes.length>20);assert.equal(validateGraph(result).filter(i=>i.severity==='error').length,0);
console.log('PASS: HRMS, semantic conversion, round trip, invalid endpoints, cycles, large graph');
