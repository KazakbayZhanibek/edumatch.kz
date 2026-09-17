const {test}=require('node:test'),assert=require('node:assert/strict');
const {runAgent}=require('../planner-agent');
const {programmes}=require('../planner-catalogue');
const input={ent:110,budget:2000000,subjects:['math','informatics'],group:'B057',year:2027,funding:'paid',language:'any'};
const call=name=>({id:'call-'+name,type:'function',function:{name,arguments:'{}'}});
const response=calls=>new Response(JSON.stringify({choices:[{finish_reason:'tool_calls',message:{tool_calls:calls}}]}));
test('agent executes tools in dependency order and returns only the checked server plan',async()=>{
 let requests=0,sourceChecks=0;
 const result=await runAgent(input,{apiKey:'test',sourceStates:()=>({}),sourceCheck:async id=>{sourceChecks++;return {id,status:'unavailable'};},fetchImpl:async(url,opts)=>{
  const body=JSON.parse(opts.body);assert.equal(body.tool_choice,'required');assert.equal(body.tools.length,4);requests++;
  return response([call(['search_programmes','check_sources','check_requirements','finish_plan'][requests-1])]);
 }});
 const expectedSources=new Set(programmes.filter(programme=>programme.group===input.group).flatMap(programme=>programme.sources)).size;
 assert.equal(result.agent.mode,'tool_agent');assert.equal(requests,4);assert.equal(sourceChecks,expectedSources);assert.equal(result.agent.trace.length,4);
 assert.equal(result.input.ent,110);assert.ok(result.tasks.length);assert.equal(result.saved,undefined);
});
test('missing fields do not invoke the model; no key uses deterministic fallback',async()=>{
 const missing=await runAgent({}, {apiKey:'test',fetchImpl:()=>{throw Error('must not call');}});assert.equal(missing.status,'needs_input');
 assert.equal((await runAgent(input,{apiKey:'',sourceStates:()=>({})})).agent.mode,'rules_fallback');
});
test('unknown tools and modified parameters cannot perform arbitrary actions',async()=>{
 for(const tool of [call('submit_application'),{...call('search_programmes'),function:{name:'search_programmes',arguments:'{"ent":140}'}}]){
  let checks=0;const result=await runAgent(input,{apiKey:'test',sourceStates:()=>({}),sourceCheck:async()=>{checks++;},fetchImpl:async()=>response([tool])});
  assert.equal(result.agent.mode,'rules_fallback');assert.equal(checks,0);assert.equal(result.input.ent,110);
 }
});
test('incorrect dependency order is bounded and never returns an uncomputed plan',async()=>{
 let rounds=0;const result=await runAgent(input,{apiKey:'test',sourceStates:()=>({}),fetchImpl:async()=>{rounds++;return response([call('finish_plan')]);}});
 assert.equal(result.agent.mode,'rules_fallback');assert.equal(rounds,6);assert.equal(result.agent.reason,'step_limit');
});
