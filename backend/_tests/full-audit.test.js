const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const Database=require('better-sqlite3');
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'edumatch-full-audit-'));
process.env.DB_PATH=path.join(fixture,'audit.db');
process.env.DOTENV_CONFIG_PATH=path.join(fixture,'absent.env');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV='test';process.env.OPENROUTER_API_KEY='';process.env.ALLOWED_ORIGINS='http://localhost:3000';
let server,base,db,storage;const tokens={},csrf={};
async function request(url,{role='guest',method='GET',body,headers={}}={}){
 const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(tokens[role]?{Cookie:'auth_token='+tokens[role]}:{}),...(method==='GET'?{}:{'X-CSRF-Token':csrf[role]}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,body:await res.json()};
}
before(async()=>{
 // The pre-catalog schema emulates a real existing database; only synthetic rows.
 const old=new Database(process.env.DB_PATH);old.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8'));
 old.prepare("INSERT INTO cities(id,name)VALUES(1,'Preserved audit city')").run();
 old.prepare("INSERT INTO universities(id,name,short_name,city_id,price_from,price_to,languages,accreditations,has_dorm,data_status)VALUES(1,'Audit university','Audit',1,100,200,'[]','[]',0,'active')").run();old.close();
 const app=require('../server');storage=require('../database');db=storage.getDb();
 const auth=require('../auth-service');for(const [id,role]of [[1,'admin'],[2,'user']]){db.prepare('INSERT INTO users(id,email,username,password_hash,is_admin,role)VALUES(?,?,?,?,?,?)').run(id,'audit'+id+'@example.test','audit'+id,'unused',role==='admin'?1:0,role);tokens[role]=auth.generateToken(id);db.prepare('INSERT INTO user_sessions(user_id,token,expires_at)VALUES(?,?,?)').run(id,tokens[role],new Date(Date.now()+3600000).toISOString());}
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 for(const role of ['guest','admin','user']){const res=await fetch(base+'/health',{headers:tokens[role]?{Cookie:'auth_token='+tokens[role]}:{}});csrf[role]=decodeURIComponent(/csrf_token=([^;]+)/.exec(res.headers.get('set-cookie'))[1]);}
});
after(async()=>{if(server)await new Promise(r=>server.close(r));storage?.closeDb();fs.rmSync(fixture,{recursive:true,force:true});});
test('startup creates missing API support tables and repeated migrations preserve rows',()=>{
 for(const table of ['grant_cities','saved_grants','data_sources','deadlines'])assert.ok(db.prepare('SELECT name FROM sqlite_master WHERE type=? AND name=?').get('table',table));
 db.prepare("INSERT INTO data_sources(source_name,notes)VALUES('Audit source','Preserve me')").run();storage.closeDb();db=storage.initDatabase();assert.equal(db.prepare('SELECT name FROM cities WHERE id=1').get().name,'Preserved audit city');assert.equal(db.prepare("SELECT notes FROM data_sources WHERE source_name='Audit source'").get().notes,'Preserve me');
});
test('catalog, saved grants, sources and deadlines work without manual SQL migrations',async()=>{
 for(const url of ['/api/grants/catalog','/api/data/sources','/api/data/deadlines'])assert.equal((await request(url)).status,200,url);
 assert.equal((await request('/api/grants/saved/list',{role:'user'})).status,200);
});
test('query analytics expose user text only to an administrator',async()=>{
 db.prepare("INSERT INTO query_log(query,user_id)VALUES('Private synthetic audit question',2)").run();
 for(const url of ['/api/analytics/top-queries','/api/analytics/stats']){assert.equal((await request(url)).status,401);assert.equal((await request(url,{role:'user'})).status,403);assert.equal((await request(url,{role:'admin'})).status,200);}
});
test('invalid review types and missing universities return controlled client errors',async()=>{
 for(const [id,body,status]of [[1,{user_name:'Audit',rating:'NaN'},400],[1,{user_name:{},rating:5},400],[99999,{user_name:'Audit',rating:5},404]]){const result=await request('/api/universities/'+id+'/reviews',{method:'POST',body});assert.equal(result.status,status);assert.doesNotMatch(JSON.stringify(result.body),/SQL|constraint|parameter/i);}
});
test('saving a missing or malformed grant does not become a database error',async()=>{
 for(const [id,status]of [['99999',404],['1abc',400]])assert.equal((await request('/api/grants/'+id+'/save',{role:'user',method:'POST',body:{}})).status,status);
});
test('a rejected CORS origin returns 403, not an internal server error',async()=>{
 assert.equal((await request('/api/cities',{headers:{Origin:'https://untrusted.invalid'}})).status,403);
});
