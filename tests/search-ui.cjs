const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./page-source.cjs')('index.html');
const start=html.indexOf('        async function handleGlobalSearch(');
const end=html.indexOf('        async function showOwnerPetsV73',start);
const code=html.slice(start,end);
function setup(){
 const elements={globalSearchInput:{value:'money'},globalSearchOwnerInput:{value:''},globalSearchResultsPanel:{hidden:true},globalSearchResultsStatus:{textContent:''}};
 let calls=[],rendered=0;
 const ctx={URLSearchParams,Map,Array,Error,console,
 document:{getElementById:id=>elements[id]},
 globalRegistrationBusyV73:false,globalSearchRequest:0,CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},
 globalSearchCriteria:(query,ownerName)=>({query,ownerName}),
 closeGlobalSearchResults(){ctx.globalSearchRequest++;},globalSearchScopeNowV73:()=>ctx.CURRENT_TENANT_ID+'|u',
 _supabase:{auth:{getSession:async()=>({data:{session:{access_token:'t',user:{id:'u'}}},error:null})}},
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({tenant_id:'A',user_id:'u',pets:[{id:'p1'},{id:'p2'}]})}},
 renderGlobalSearchResultsV73(){rendered++;},updateRecentSearchButtonV73(){}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,elements,calls,get rendered(){return rendered;}};
}
(async()=>{
 let s=setup();await s.ctx.handleGlobalSearch({key:'Enter',isComposing:true});assert.equal(s.calls.length,0);
 s=setup();await s.ctx.handleGlobalSearch({key:'a'});assert.equal(s.calls.length,0);
 s=setup();await s.ctx.handleGlobalSearch({key:'Enter',repeat:true});assert.equal(s.calls.length,0);
 s=setup();await s.ctx.handleGlobalSearch({key:'Enter',preventDefault(){}});
 assert.equal(s.calls.length,1);assert.equal(s.calls[0].options.headers.Authorization,'Bearer t');
 assert.equal(s.ctx.globalSearchMatches.size,2);assert.equal(s.rendered,1);assert.equal(s.elements.globalSearchInput.value,'');
 // A changed clinic while the request is pending must never render old matches.
 s=setup();s.ctx.fetch=async()=>{s.ctx.CURRENT_TENANT_ID='B';return {ok:true,json:async()=>({tenant_id:'A',user_id:'u',pets:[{id:'p'}]})}};
 await s.ctx.handleGlobalSearch({key:'Enter',preventDefault(){}});assert.equal(s.rendered,0);
 // Backend rejection remains visible and does not render/register pets.
 s=setup();s.ctx.console={error(){}};s.ctx.fetch=async()=>({ok:false,json:async()=>({error:'登入已失效'})});
 await s.ctx.handleGlobalSearch({key:'Enter',preventDefault(){}});assert.equal(s.rendered,0);assert.equal(s.elements.globalSearchResultsStatus.textContent,'登入已失效');
 assert(!code.includes(".from('pets')"));assert(!code.includes('addGlobalSearchPetToWaiting('));
 console.log('Search UI checks passed: IME, repeat, one request, rendering, stale clinic, rejected session, no automatic registration.');
})().catch(e=>{console.error(e);process.exit(1)});
