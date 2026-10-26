const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/frontend/index/block-23.js','utf8');
const start=source.indexOf('async function load(){'),end=source.indexOf("\n$('reload')",start);
async function run(mismatch=false){
 const calls=[],resolvers={};let rendered=false;
 const ctx={CURRENT_TENANT_ID:'A',weekV60:'2026-10-26',state:null,rpc:(action)=>{calls.push(action);return new Promise(resolve=>resolvers[action]=resolve);},$:()=>({replaceChildren(){},hidden:false,value:'',textContent:'',href:''}),showBookingNoticeV62(){},closeReview(){},renderScheduleV60(){},renderCalendarV60:async data=>{assert.equal(data.tenant_id,'A');rendered=true;}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 const promise=ctx.load();assert.deepEqual(calls,['list','calendar'],'both reads start before either response');
 resolvers.list({config:{tenant_id:'A'},slots:[],requests:[],admin:true,pending_count:0});
 resolvers.calendar({tenant_id:mismatch?'B':'A'});
 if(mismatch){await assert.rejects(promise);assert.equal(rendered,false);}else{await promise;assert.equal(rendered,true);}
}
(async()=>{await run();await run(true);console.log('Booking: list/calendar reads overlap, prefetched calendar reused, wrong tenant blocked.');})().catch(e=>{console.error(e);process.exit(1)});
