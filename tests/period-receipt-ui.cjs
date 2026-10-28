const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/frontend/index/block-75.js','utf8');
function setup(){
 const elements={},reports=[];let prints=0;
 class Node {constructor(tag='div'){this.tag=tag;this.style={};this.dataset={};this.children=[];this.value='';this.textContent='';this.disabled=false;this.classList={contains:()=>true};}
  set innerHTML(v){for(const m of v.matchAll(/id="([^"]+)"/g))elements[m[1]]=new Node();}
  append(...nodes){this.children.push(...nodes);}
  after(){} prepend(){} replaceChildren(){this.children=[];} setAttribute(){} focus(){} scrollIntoView(){} remove(){}
  querySelectorAll(s){return this.children.filter(n=>n.tag==='details'&&n.dataset.periodNeedsReview==='true');}
 }
 const doc={getElementById:id=>elements[id]||(elements[id]=new Node()),createElement:tag=>new Node(tag),body:{append(f){if(f.onload){f.contentWindow={focus(){},print(){prints++}};f.onload();}}}};
 const base={tenant_id:'A',revision:'r1',from:'2026-09-27',to:'2026-10-27',basis:'issued',as_of:'2026-10-27T01:00:00Z',clinic:{name:'院'},owner:{name:'王'},pet:{name:'小白'},pending:[],invoices:[{id:'1',event_at:'2026-10-01T00:00:00Z',created_at:'2026-10-01T00:00:00Z',total:1600,paid:0,refunded:0,due:0,net:null,issue:'舊帳單沒有對應收款紀錄',items:[],payments:[],refunds:[]}],summary:{receipt_allowed:false,issue_count:3,unassigned_refund_count:0,voided_residual:0,paid:10500,refunded:0,net:10500,billed:15900,due:0,unknown:5400,invoice_count:9,pending_count:0,voided_count:0}};
 const ctx={document:doc,Intl,Date,Set,Number,console,CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},CURRENT_PROFILE:{role:'admin'},posScopeNowV77:()=> 'A|u',switchTab(){},loadCurrentUserProfile:async()=>{},logoutSupabase(){},setTimeout(){},_supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'u'},access_token:'test'}}})},rpc:async(name,args)=>{assert.equal(name,'period_fees_v932');if(args.p_action==='search')return {data:{tenant_id:'A',matches:[{id:'p',name:'小白',species:'犬',owner_id:'o',owner_name:'王'}]},error:null};reports.push(args);return {data:structuredClone(ctx.report),error:null};}},report:base};
 ctx.fetch=async (url,options)=>{const payload=JSON.parse(options.body);assert.equal(payload.action,'report');reports.push(payload);return {ok:true,json:async()=>({user_id:'u',data:structuredClone(ctx.report)})};};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,e:elements,prints:()=>prints,reports};
}
(async()=>{
 const {ctx,e,prints,reports}=setup();
 assert.equal(e.periodPrintReceiptV932.disabled,false);
 await e.periodPrintReceiptV932.onclick();assert.match(e.periodMessageV932.textContent,/請先搜尋/);assert.equal(prints(),0);
 e.periodSearchV932.value='小白';await e.periodSearchButtonV932.onclick();e.periodMatchesV932.children[0].onclick();e.periodFromV932.value='2026-09-27';e.periodToV932.value='2026-10-27';e.periodBasisV932.value='issued';await e.periodLoadV932.onclick();
 assert.equal(e.periodPrintReceiptV932.disabled,false);await e.periodPrintReceiptV932.onclick();assert.match(e.periodMessageV932.textContent,/3張帳單/);assert.equal(e.periodResultV932.children.find(n=>n.dataset.periodNeedsReview).open,true);assert.equal(prints(),0);assert.equal(reports.length,1);
 ctx.report.summary.receipt_allowed=true;ctx.report.summary.issue_count=0;ctx.report.invoices[0].issue=null;ctx.report.invoices[0].paid=1300;ctx.report.invoices[0].subtotal=1300;ctx.report.invoices[0].discount=0;ctx.report.invoices[0].total=1300;ctx.report.invoices[0].items=[{name:'診察費',subtotal:1300}];ctx.report.summary.paid=1300;ctx.report.summary.net=1300;ctx.report.revision='r2';await e.periodLoadV932.onclick();await e.periodPrintReceiptV932.onclick();assert.equal(prints(),1);
 ctx.report.summary.receipt_allowed=false;ctx.report.summary.issue_count=1;await e.periodPrintReceiptV932.onclick();assert.equal(prints(),1);assert.match(e.periodMessageV932.textContent,/1張帳單/);
 console.log('Period receipt: blocked button explains issue and expands records; verified receipts print; rechecked blocked data never prints.');
})().catch(e=>{console.error(e);process.exit(1)});
