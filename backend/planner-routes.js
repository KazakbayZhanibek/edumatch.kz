const router=require('express').Router();
const {verifyAuth,verifyAdmin}=require('./auth-middleware');
const {getDb}=require('./database');
const {buildPlan}=require('./admission-planner');
const {buildProgrammePlan,makeTasks}=require('./programme-planner');
const {checkSource,interpret,getSourceStates,setSourceStore}=require('./planner-tools');
const sourceStore=require('./planner-source-store').createSourceStore(getDb);
setSourceStore(sourceStore);
const {sources}=require('./planner-catalogue');
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/sources/:id/history',verifyAuth,verifyAdmin,(req,res,next)=>{try{
 if(!Object.hasOwn(sources,req.params.id))return res.status(404).json({error:'Источник не найден / Дереккөз табылмады'});
 res.json({source:sources[req.params.id],observations:sourceStore.history(req.params.id)});
}catch(e){next(e);}});
// Bounded process-local rate limits for network tools, without retaining personal text.
const limits=new Map();
function toolLimit(req,res,next){
 const now=Date.now(),key=String(req.userId||req.ip);
 if(limits.size>=5000)for(const [k,v] of limits)if(v.until<now)limits.delete(k);
 if(!limits.has(key)&&limits.size>=5000)return res.status(429).json({error:'Повторите позже / Кейін қайталаңыз'});
 let value=limits.get(key);if(!value||value.until<now)value={count:0,until:now+60000};
 limits.set(key,value);if(++value.count>10)return res.status(429).json({error:'Слишком много запросов / Сұраулар тым көп'});next();
}
router.post('/interpret',verifyAuth,toolLimit,async(req,res,next)=>{try{res.json(await interpret(req.body?.message,req.body?.lang));}catch(e){next(e);}});
router.post('/agent',verifyAuth,toolLimit,async(req,res,next)=>{try{
 const result=await require('./planner-agent').runAgent(req.body);
 res.status(result.status==='invalid'?400:200).json(result);
}catch(e){next(e);}});
router.post('/programme-preview',(req,res,next)=>{try{const plan=buildProgrammePlan(req.body,new Date(),getSourceStates());res.status(plan.status==='invalid'?400:200).json(plan);}catch(e){next(e);}});
router.post('/sources/check',toolLimit,async(req,res,next)=>{try{
 const ids=req.body?.ids;
 if(!Array.isArray(ids)||!ids.length||ids.length>6||!ids.every(id=>typeof id==='string'&&Object.hasOwn(sources,id)))return res.status(400).json({error:'Некорректные источники / Қате дереккөздер'});
 if(req.body.input!==undefined){const draft=buildProgrammePlan(req.body.input);if(draft.status!=='ready')return res.status(400).json(draft);}
 const results=await Promise.all([...new Set(ids)].map(id=>checkSource(id)));
 const plan=req.body.input?buildProgrammePlan(req.body.input,new Date(),getSourceStates()):undefined;
 res.json({sources:results,plan,note:'Markers and changes only; requirements are not automatically verified.'});
}catch(e){next(e);}});
router.post('/preview',(req,res,next)=>{try{const plan=buildPlan(req.body);res.status(plan.status==='invalid'?400:200).json(plan);}catch(e){next(e);}});
router.post('/plans',verifyAuth,(req,res,next)=>{try{
 const plan=req.body?.input?.mode==='programmes'?buildProgrammePlan(req.body.input,new Date(),getSourceStates()):buildPlan(req.body?.input);
 if(plan.status!=='ready')return res.status(400).json(plan);
 const selected=req.body.selectedIds;
 if(!Array.isArray(selected)||selected.length<1||selected.length>3||new Set(selected).size!==selected.length||!selected.every(id=>plan.matches.some(m=>m.id===id)))return res.status(400).json({error:'Выберите 1–3 варианта из текущего подбора / 1–3 нұсқаны таңдаңыз'});
 plan.matches=plan.matches.filter(m=>selected.includes(m.id));
 if(plan.mode==='programmes')plan.tasks=makeTasks(plan.input,plan.matches);
 const db=getDb();
 if(db.prepare('SELECT COUNT(*) n FROM admission_plans WHERE user_id=?').get(req.userId).n>=50)return res.status(409).json({error:'Лимит 50 планов / 50 жоспар шегі'});
 const result=db.prepare('INSERT INTO admission_plans(user_id,payload) VALUES (?,?)').run(req.userId,JSON.stringify(plan));res.status(201).json({id:result.lastInsertRowid,plan});
}catch(e){next(e);}});
router.get('/plans',verifyAuth,(req,res,next)=>{try{
 const now=new Date(),states=getSourceStates();
 const plans=getDb().prepare('SELECT id,payload,created_at FROM admission_plans WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.userId).map(r=>{
   const plan=JSON.parse(r.payload);
   return {id:r.id,created_at:r.created_at,plan,review:require('./planner-snapshot-review').reviewSnapshot(plan,now,states)};
 });
 res.json({plans});
}catch(e){next(e);}});
router.patch('/plans/:id/tasks',verifyAuth,(req,res,next)=>{try{
 const {taskId,done}=req.body||{};
 if(typeof taskId!=='string'||typeof done!=='boolean')return res.status(400).json({error:'Некорректный шаг / Қате қадам'});
 const db=getDb();
 const result=db.transaction(()=>{
   const row=db.prepare('SELECT payload FROM admission_plans WHERE id=? AND user_id=?').get(req.params.id,req.userId);
   if(!row)return null;
   const plan=JSON.parse(row.payload),task=plan.tasks?.find(t=>t.id===taskId);if(!task)return null;
   task.done=done;db.prepare('UPDATE admission_plans SET payload=? WHERE id=? AND user_id=?').run(JSON.stringify(plan),req.params.id,req.userId);return {success:true};
 })();res.status(result?200:404).json(result||{error:'Не найдено / Табылмады'});
}catch(e){next(e);}});
router.delete('/plans/:id',verifyAuth,(req,res,next)=>{try{const result=getDb().prepare('DELETE FROM admission_plans WHERE id=? AND user_id=?').run(req.params.id,req.userId);res.status(result.changes?200:404).json({success:!!result.changes});}catch(e){next(e);}});
module.exports=router;
