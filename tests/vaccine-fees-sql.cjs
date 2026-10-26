// NODE_PATH=<directory containing @electric-sql/pglite> node tests/vaccine-fees-sql.cjs
const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create table public.vaccine_types(id integer primary key,name text);insert into public.vaccine_types values(1,'existing');`);
 const sql=fs.readFileSync('database/existing/05_vaccine_standard_fee_20261026.sql','utf8');await db.exec(sql);await db.exec(sql);
 let r=await db.query('select * from vaccine_types');assert.equal(r.rows.length,1);assert.equal(r.rows[0].name,'existing');assert.equal(r.rows[0].default_fee,null);
 for(const v of [0,1000,99999999.99])await db.exec('update vaccine_types set default_fee='+v+' where id=1');
 for(const v of ['-1','1.234','100000000',"'NaN'::numeric"]){let failed=false;try{await db.exec('update vaccine_types set default_fee='+v+' where id=1')}catch{failed=true;}assert(failed,'invalid fee rejected: '+v);}
 await db.exec('update vaccine_types set default_fee=null');
 await db.close();console.log('PASS PostgreSQL vaccine fee migration: rerun safe; existing rows preserved; unset remains null; zero allowed; bounds and decimals enforced');
})().catch(e=>{console.error(e);process.exit(1)});
