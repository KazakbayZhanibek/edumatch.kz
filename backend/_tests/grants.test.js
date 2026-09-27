const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deadlineStatus,filterRows,safeLink,esc,today}=require('../../frontend/js/grants');
const rows=[
 {id:1,name:'Грант А',type:'government',academic_year:'2026-2027',deadline:'2026-07-20',requirements:['Гражданство РК']},
 {id:2,name:'Грант Б',type:'university',academic_year:'2026-2027',deadline:'2026-09-15',university_name:'Тестовый вуз',requirements:[]},
 {id:3,name:'Грант В',type:'university',academic_year:'2025-2026',deadline:null,requirements:[]},
];
test('grant deadline handles expiry, same day and malformed dates',()=>{
 assert.equal(deadlineStatus('2026-09-14','2026-09-14'),'future');
 assert.equal(deadlineStatus('2026-09-13','2026-09-14'),'expired');
 for(const value of [null,'soon','2026-02-30','2026-13-01']) assert.equal(deadlineStatus(value),'unknown');
 assert.equal(today(new Date('2026-09-13T20:00:00Z')),'2026-09-14');
});
test('grant filters combine search, type, year, deadline and saved IDs',()=>{
 assert.deepEqual(filterRows(rows,{search:'тестовый',type:'university',year:'2026-2027',status:'future',saved:true},[2],'2026-09-14').map(g=>g.id),[2]);
 assert.equal(filterRows(rows,{type:'corporate'},[],'2026-09-14').length,0);
 assert.deepEqual(filterRows(rows,{search:'гражданство'},[],'2026-09-14').map(g=>g.id),[1]);
});
test('grant ordering puts future dates first without modifying source',()=>{
 assert.deepEqual(filterRows(rows,{},[],'2026-09-14').map(g=>g.id),[2,3,1]);
 assert.deepEqual(rows.map(g=>g.id),[1,2,3]);
});
test('grant links reject script, data and credential URLs',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hi','https://user:password@example.com','/relative']) assert.equal(safeLink(url),'');
 assert.equal(safeLink('https://example.com'),'https://example.com/');
});
test('grant text is escaped before HTML rendering',()=>{
 assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
