// Only public-source diagnostics are stored, never page bodies or user prompts.
const schema=`
CREATE TABLE IF NOT EXISTS planner_source_state (
 source_id TEXT PRIMARY KEY, checked_ms INTEGER NOT NULL, payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS planner_source_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL,
 checked_ms INTEGER NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_planner_source_history ON planner_source_history(source_id,id);
`;
function createSourceStore(getDatabase){
 return {
  get(id){const row=getDatabase().prepare('SELECT checked_ms,payload FROM planner_source_state WHERE source_id=?').get(id);return row?{time:row.checked_ms,result:JSON.parse(row.payload)}:undefined;},
  all(){return Object.fromEntries(getDatabase().prepare('SELECT source_id,payload FROM planner_source_state').all().map(row=>[row.source_id,JSON.parse(row.payload)]));},
  put(id,time,result){
   const db=getDatabase();return db.transaction(()=>{
    const previous=this.get(id);
    // An older request must not overwrite a newer observation in another worker.
    if(previous&&previous.time>time)return previous.result;
    const next={...result,reviewRequired:!!previous?.result.reviewRequired||!!result.reviewRequired};
    if(result.status==='reachable'&&previous?.result.contentHash&&previous.result.contentHash!==result.contentHash){next.reviewRequired=true;next.changeStatus='changed';}
    if(!next.contentHash&&previous?.result.contentHash)next.contentHash=previous.result.contentHash;
    const payload=JSON.stringify(next);
    db.prepare('INSERT INTO planner_source_state(source_id,checked_ms,payload) VALUES (?,?,?) ON CONFLICT(source_id) DO UPDATE SET checked_ms=excluded.checked_ms,payload=excluded.payload').run(id,time,payload);
    db.prepare('INSERT INTO planner_source_history(source_id,checked_ms,payload) VALUES (?,?,?)').run(id,time,payload);
    // Bounded diagnostic journal: keep the latest 100 observations per source.
    db.prepare('DELETE FROM planner_source_history WHERE source_id=? AND id NOT IN (SELECT id FROM planner_source_history WHERE source_id=? ORDER BY id DESC LIMIT 100)').run(id,id);
    return next;
   })();
  },
  history(id){return getDatabase().prepare('SELECT checked_ms,payload FROM planner_source_history WHERE source_id=? ORDER BY id DESC LIMIT 100').all(id).map(row=>JSON.parse(row.payload));}
 };
}
module.exports={schema,createSourceStore};
