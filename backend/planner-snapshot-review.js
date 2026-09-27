const {buildProgrammePlan}=require('./programme-planner');

// Read-only reassessment: never replace the saved checklist or completed tasks.
function reviewSnapshot(plan,now=new Date(),sourceStates={},catalogue) {
  if(plan.mode!=='programmes')return null;
  const current=buildProgrammePlan(plan.input,now,sourceStates,catalogue);
  if(current.status!=='ready')return {status:'needs_review',checkedAt:now.toISOString(),programmes:[]};
  const candidates=[...current.matches,...current.excluded];
  const programmes=plan.matches.map(saved=>{
    const item=candidates.find(p=>p.id===saved.id);
    return item?{id:item.id,name:item.name,verification:item.verification,blockers:item.blockers,unverifiedCriteria:item.unverifiedCriteria,cost:item.cost}:
      {id:saved.id,name:saved.name,verification:'unavailable',blockers:[],unverifiedCriteria:[]};
  });
  return {status:'reviewed',checkedAt:now.toISOString(),programmes};
}
module.exports={reviewSnapshot};
