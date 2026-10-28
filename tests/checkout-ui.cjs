const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./page-source.cjs')('index.html');
function extract(a,b){const x=html.indexOf(a),y=html.indexOf(b,x);assert(x>=0&&y>x);return html.slice(x,y)}
const bridge=extract('async function posCheckoutDjangoV7(', 'async function posActionV77(');
const direct=extract('async function posDirectV77(', 'async function posFamilyRpcV77(');
const frozen=extract('function posKeyV77(', 'function posReceiptV77(');
function setup(replies){
 const storage=new Map();let calls=[],rpcCalls=[],n=0;
 const ctx={Error,JSON,Map,crypto:{randomUUID:()=> 'request-'+(++n)},CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},
 posScopeNowV77:()=>ctx.CURRENT_USER.id+'|'+ctx.CURRENT_TENANT_ID,
 sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 _supabase:{auth:{getSession:async()=>({data:{session:{access_token:'t',user:{id:'u'}}},error:null})},rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:{pending:[]},error:null}}},
 fetch:async(url,options)=>{calls.push({url,options,payload:JSON.parse(options.body)});const reply=replies.shift();if(reply instanceof Error)throw reply;if(reply.changeScope)ctx.CURRENT_TENANT_ID='B';return {ok:reply.ok??true,json:async()=>reply.body}},
 posRequireShiftV84:async()=>({id:'shift'}),posMethodV77:value=>value,posTenderV77:()=>100,posRefreshV77:async()=>{},document:{getElementById:()=>({value:'現金'})}};
 vm.createContext(ctx);vm.runInContext(frozen+bridge+direct,ctx);return {ctx,storage,calls,rpcCalls};
}
const success={body:{tenant_id:'A',user_id:'u',data:'invoice'}};
const args={p_tenant_id:'A',p_category:'商品',p_total:30,p_subtotal:30,p_discount:0,p_lines:[{quantity:0.33,unit_price:100}]};
(async()=>{
 let s=setup([new Error('network uncertain'),success]);await assert.rejects(s.ctx.posDirectV77('checkout_with_inventory',args));assert.equal(s.storage.size,1);
 const frozenPayload=JSON.parse([...s.storage.values()][0]);await s.ctx.posDirectV77('checkout_with_inventory',args);assert.equal(s.storage.size,0);assert.deepEqual(s.calls[0].payload,s.calls[1].payload);assert.equal(s.calls[1].payload.id,frozenPayload.id);assert.equal(s.calls[0].options.headers.Authorization,'Bearer t');assert.equal(s.rpcCalls.length,0);
 s=setup([{ok:false,body:{error:'收到現金不足',code:'P0001'}}]);await assert.rejects(s.ctx.posDirectV77('checkout_with_inventory',args),/收到現金不足/);assert.equal(s.storage.size,0);
 s=setup([{ok:false,body:{error:'尚未送出',code:'GB_REQUEST_REJECTED'}}]);await assert.rejects(s.ctx.posDirectV77('checkout_with_inventory',args));assert.equal(s.storage.size,0);
 s=setup([{ok:false,body:{error:'回覆不完整'}}]);await assert.rejects(s.ctx.posDirectV77('checkout_with_inventory',args));assert.equal(s.storage.size,1);
 s=setup([{body:{tenant_id:'B',user_id:'u',data:'invoice'}}]);await assert.rejects(s.ctx.posDirectV77('checkout_with_inventory',args));assert.equal(s.storage.size,1);
 s=setup([{...success,changeScope:true}]);await assert.rejects(s.ctx.posDirectV77('checkout_with_inventory',args));assert.equal(s.storage.size,1);
 s=setup([success]);await s.ctx.posRpcV77('list');assert.equal(s.calls[0].url,'/api/pos/list/');assert.equal(s.rpcCalls.length,0);
 for(const action of ['stage','direct','pay','edit','cancel']){s=setup([success]);await s.ctx.posRpcV77(action,{id:'fixed-request'});assert.equal(s.calls[0].url,'/api/checkout/'+action+'/');assert.equal(s.rpcCalls.length,0);assert.equal(s.calls[0].payload.id,'fixed-request');}
 for(const action of ['work_list_v854','finance_status','reissue_links_v854','daily_summary','bank_pending','dispensing']){s=setup([success]);await s.ctx.posRpcV77(action,{id:'original'});assert.equal(s.calls[0].url,'/api/pos/'+action+'/');assert.equal(s.calls[0].payload.id,'original');assert.equal(s.rpcCalls.length,0);}
 s=setup([]);await s.ctx.posRpcV77('today_work',{id:'keep-original'});assert.equal(s.calls.length,0);assert.equal(s.rpcCalls.length,1);
 console.log('Checkout UI checks passed: named Django routes preserve payloads/request IDs; uncertain failures retain recovery; SQL rejections retain codes; remaining legacy actions keep original routing.');
})().catch(e=>{console.error(e);process.exit(1)});
