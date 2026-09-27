const {getDb}=require('./database');
function buildPlan(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {status:'invalid',error:'Некорректные параметры / Қате параметрлер'};
  const missing=['ent','subjects','budget','specialtyId'].filter(k=>input[k]===undefined || input[k]===null || input[k]==='' || (k==='subjects' && (!Array.isArray(input[k]) || input[k].length!==2)));
  if(missing.length) return {status:'needs_input',missing};
  if(!Number.isInteger(input.ent)||input.ent<0||input.ent>140||!Number.isFinite(input.budget)||input.budget<0||input.budget>100000000||!Number.isSafeInteger(input.specialtyId)||!input.subjects.every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=80)||new Set(input.subjects.map(s=>s.trim().toLowerCase())).size!==2) return {status:'invalid',error:'Проверьте ЕНТ (0–140), бюджет и два разных предмета / ҰБТ, бюджет және екі бөлек пәнді тексеріңіз'};
  if(input.city && (typeof input.city!=='string'||input.city.length>100)) return {status:'invalid',error:'Некорректный город / Қате қала'};
  if(input.needDorm!==undefined && typeof input.needDorm!=='boolean') return {status:'invalid',error:'Некорректное значение общежития'};
  const db=getDb(), specialty=db.prepare('SELECT id,name FROM specialties WHERE id=?').get(input.specialtyId);
  if(!specialty) return {status:'invalid',error:'Направление не найдено / Бағыт табылмады'};
  const candidates=db.prepare(`SELECT u.id,u.name,u.price_from,u.price_to,u.has_dorm,u.website,c.name city
    FROM universities u JOIN university_specialties us ON us.university_id=u.id JOIN cities c ON c.id=u.city_id
    WHERE us.specialty_id=? AND COALESCE(u.data_status,'active')='active' ORDER BY u.price_from,u.id`).all(input.specialtyId);
  const checked=candidates.map(u=>{
    const checks={budget:!Number.isFinite(u.price_from)||u.price_from<=0?'unknown':u.price_from>input.budget?'outside':Number.isFinite(u.price_to)&&u.price_to>0&&u.price_to<=input.budget?'within':'partial',city:!input.city||u.city.toLowerCase().includes(input.city.trim().toLowerCase())?'within':'outside',dorm:!input.needDorm?'not_requested':u.has_dorm===1?'listed':u.has_dorm===0?'outside':'unknown',ent:'unverified',subjects:'unverified',programme:'unverified'};
    let source=null;try{const url=new URL(u.website);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)source=url.href;}catch{}
    return {...u,website:source,checks,verification:'needs_official_confirmation'};
  });
  const matches=checked.filter(u=>!Object.values(u.checks).includes('outside')).slice(0,12);
  return {status:'ready',input:{ent:input.ent,subjects:input.subjects.map(s=>s.trim()),budget:input.budget,specialtyId:input.specialtyId,city:input.city?.trim()||'',needDorm:!!input.needDorm},specialty:specialty.name,matches,
    excluded:checked.filter(u=>Object.values(u.checks).includes('outside')).slice(0,12),total:candidates.length,
    tools:[{name:'catalogue_search',count:candidates.length},{name:'preference_check',count:matches.length},{name:'source_check',result:'Only website links are available; programme requirements are not verified.'}],
    steps:['confirm_programme','confirm_subjects_ent','confirm_cost_grants','prepare_documents','confirm_deadline'],createdAt:new Date().toISOString(),mode:'structured_catalogue_preview'};
}
module.exports={buildPlan};
