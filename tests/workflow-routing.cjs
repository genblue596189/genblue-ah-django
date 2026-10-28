// Pure local transport checks: no browser, credentials, Supabase or clinic data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/frontend/index/pharmacyRoomV9133.js','utf8');
const start=source.indexOf('async function pharmacyRpcV9133(');
const end=source.indexOf('\nasync function pharmacyActionV9133',start);
assert(start>=0&&end>start);
const helper=source.slice(start,end);
function setup(reply){
 const calls=[];
 const ctx={Error,JSON,encodeURIComponent,CURRENT_USER:{id:'staff-A'},CURRENT_TENANT_ID:'clinic-A',
 pharmacyScopeV9133:()=>ctx.CURRENT_TENANT_ID+'|'+ctx.CURRENT_USER.id,
 _supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'staff-A'},access_token:'fixture-token'}}})}},
 fetch:async(url,options)=>{calls.push({url,options,payload:JSON.parse(options.body)});if(reply instanceof Error)throw reply;
 if(reply.switchClinic)ctx.CURRENT_TENANT_ID='clinic-B';return {ok:reply.ok??true,json:async()=>reply.body};}};
 vm.createContext(ctx);vm.runInContext(helper,ctx);return {ctx,calls};
}
(async()=>{
 const original={id:'original-job',version:7,reason:'請醫師確認'};
 for(const action of ['list','counts','staff','export','permission','send','claim','complete','return','cancel','handed']){
  const reply={tenant_id:'clinic-A',job:{id:'original-job'}};
  const s=setup({body:{tenant_id:'clinic-A',user_id:'staff-A',data:reply}});
  assert.deepEqual(JSON.parse(JSON.stringify(await s.ctx.pharmacyRpcV9133(action,original))),reply);
  assert.equal(s.calls[0].url,'/api/pharmacy/'+action+'/');assert.deepEqual(s.calls[0].payload,original);
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].options.headers.Authorization,'Bearer fixture-token');
 }
 let s=setup(Error('connection lost'));await assert.rejects(s.ctx.pharmacyRpcV9133('send',original));assert.equal(s.calls.length,1);
 s=setup({ok:false,body:{error:'配藥單已更新',code:'P0001'}});
 await assert.rejects(s.ctx.pharmacyRpcV9133('complete',original),e=>e.code==='P0001');assert.equal(s.calls.length,1);
 s=setup({body:{tenant_id:'clinic-B',user_id:'staff-A',data:{tenant_id:'clinic-B'}}});
 await assert.rejects(s.ctx.pharmacyRpcV9133('send',original),/回覆不符/);
 s=setup({switchClinic:true,body:{tenant_id:'clinic-A',user_id:'staff-A',data:{tenant_id:'clinic-A'}}});
 await assert.rejects(s.ctx.pharmacyRpcV9133('send',original),/登入已變更/);
 s=setup({body:{tenant_id:'clinic-A',user_id:'other-user',data:{tenant_id:'clinic-A'}}});
 await assert.rejects(s.ctx.pharmacyRpcV9133('claim',original),/回覆不符/);
 console.log('Pharmacy transport checks passed: original job/version/payload, one request, definitive SQL codes, ambiguous errors and user/clinic guards.');
})().catch(error=>{console.error(error);process.exitCode=1;});
