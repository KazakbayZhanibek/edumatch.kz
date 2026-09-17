// Read-only: never relabel years or change deadlines merely to pass an audit.
const Database=require('better-sqlite3');
const path=require('node:path');
const {deadlineStatus,today}=require('../../frontend/js/grants');
const db=new Database(process.env.DB_PATH || path.join(__dirname,'../edumatch.db'),{readonly:true});
try {
 const rows=db.prepare('SELECT id,name,type,academic_year,deadline,link FROM grants').all();
 const day=today();
 const report={as_of:day,total:rows.length,years:{},types:{},expired:0,date_not_passed:0,unknown_deadline:0,
  note:'Dates are database values, not verified application status. Verification status and source provenance are stored per record.'};
 for(const g of rows){report.years[g.academic_year || 'unknown']=(report.years[g.academic_year || 'unknown']||0)+1;report.types[g.type]=(report.types[g.type]||0)+1;const s=deadlineStatus(g.deadline,day);report[s==='expired'?'expired':s==='future'?'date_not_passed':'unknown_deadline']++;}
 report.specialty_links=db.prepare('SELECT COUNT(*) AS n FROM grant_specialties').get().n;
 report.source_urls=db.prepare("SELECT COUNT(*) AS n FROM grants WHERE source_url IS NOT NULL AND source_url != ''").get().n;
 report.verification_status=db.prepare('SELECT verification_status, COUNT(*) AS count FROM grants GROUP BY verification_status').all();
 report.deadlines=db.prepare('SELECT deadline,COUNT(*) AS count FROM grants GROUP BY deadline ORDER BY deadline').all();
 console.log(JSON.stringify(report,null,2));
} finally {db.close();}
