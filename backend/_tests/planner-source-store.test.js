const {test}=require('node:test');
const assert=require('node:assert/strict');
const Database=require('better-sqlite3');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {schema,createSourceStore}=require('../planner-source-store');
const {setSourceStore,checkSource,getSourceStates}=require('../planner-tools');
test('source warnings and baseline survive closing and reopening the database',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'planner-source-test-')),file=path.join(directory,'sources.db');
 let db=new Database(file);db.exec(schema);setSourceStore(createSourceStore(()=>db));
 const start=Date.now(),html='B057 Software Engineering Математика Информатика';
 const fetchText=text=>async()=>new Response(text,{headers:{'content-type':'text/html'}});
 try{
  await checkSource('aitu',{now:start,fetchImpl:fetchText(html)});
  const changed=await checkSource('aitu',{now:start+300001,fetchImpl:fetchText(html+' changed')});
  assert.equal(changed.reviewRequired,true);
  setSourceStore(null);db.close();db=new Database(file);db.exec(schema);
  const store=createSourceStore(()=>db);setSourceStore(store);
  assert.equal(getSourceStates().aitu.reviewRequired,true);
  const unchanged=await checkSource('aitu',{now:start+600002,fetchImpl:fetchText(html+' changed')});
  assert.equal(unchanged.changeStatus,'unchanged');assert.equal(unchanged.reviewRequired,true);
  let requests=0;
  assert.equal((await checkSource('aitu',{now:start+600003,fetchImpl:async()=>{requests++;throw Error();}})).cached,true);
  assert.equal(requests,0);assert.equal(store.history('aitu').length,3);
 }finally{setSourceStore(null);db.close();fs.rmSync(directory,{recursive:true,force:true});}
});
test('journal is bounded, sticky warnings merge, older observations cannot overwrite new ones',()=>{
 const db=new Database(':memory:');db.exec(schema);const store=createSourceStore(()=>db);
 try{
  for(let i=0;i<105;i++)store.put('aitu',i,{id:'aitu',status:'reachable',contentHash:'abc',reviewRequired:i===0,checkedAt:new Date(i).toISOString()});
  assert.equal(store.history('aitu').length,100);assert.equal(store.get('aitu').result.reviewRequired,true);
  const older=store.put('aitu',1,{id:'aitu',status:'unavailable',reviewRequired:false});
  assert.equal(older.status,'reachable');assert.equal(store.get('aitu').time,104);
  const failed=store.put('aitu',106,{id:'aitu',status:'unavailable',reviewRequired:false});
  assert.equal(failed.contentHash,'abc');assert.equal(failed.reviewRequired,true);
  assert.deepEqual(store.history('unknown'),[]);
 }finally{db.close();}
});
test('a newer worker detects changed content against the database baseline',()=>{
 const db=new Database(':memory:');db.exec(schema);
 try{
  const first=createSourceStore(()=>db),second=createSourceStore(()=>db);
  first.put('aitu',1,{status:'reachable',contentHash:'old',reviewRequired:false});
  const updated=second.put('aitu',2,{status:'reachable',contentHash:'new',reviewRequired:false});
  assert.equal(updated.reviewRequired,true);assert.equal(updated.changeStatus,'changed');
  assert.equal(first.all().aitu.contentHash,'new');
 }finally{db.close();}
});
