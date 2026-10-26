const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class El{
 constructor(){this.children=[];this.dataset={};this.style={};this.value='';this.hidden=false;this.listeners={};}
 append(...x){this.children.push(...x)} appendChild(x){this.append(x)} replaceChildren(...x){this.children=x;this.textContent='';}setAttribute(){}
 addEventListener(k,fn){this.listeners[k]=fn} get options(){return this.children}get selectedOptions(){return this.children.filter(x=>x.value===this.value)}
}
const elements={},get=id=>elements[id]??=new El(),writes=[];
let responseFee=900;
const c={CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},CURRENT_PROFILE:{role:'admin'},vaccineTypesFeeScope20261026:'A|u',vaccineTypesFeeRows20261026:[],Number,String,Math,Error,Array,
 document:{getElementById:get,createElement:()=>new El()},_supabase:{from:table=>{
 const call={table,filters:[]};return {update(payload){call.payload=payload;return this},eq(k,v){call.filters.push([k,v]);return this},is(k,v){call.filters.push([k,v]);return this},select(){return this},async single(){writes.push(call);return {data:{id:'v1',default_fee:responseFee}}}};
 }}};
vm.createContext(c);vm.runInContext(fs.readFileSync('assets/frontend/index/vaccineFees20261026.js','utf8'),c);
const run=s=>vm.runInContext(s,c),option=(id,name,fee)=>{const e=new El();e.value=name;e.dataset={vaccineTypeId:id,defaultFee:fee};return e;};
(async()=>{
 for(const value of ['-1','1.234','Infinity','NaN','100000000'])assert.throws(()=>c.vaccineFeeValue20261026(value));
 assert.equal(c.vaccineFeeValue20261026(''),null);assert.equal(c.vaccineFeeValue20261026('0'),0);assert.equal(c.vaccineFeeValue20261026('99999999.99'),99999999.99);
 const select=get('vacTypeSelect');select.append(option('v1','犬疫苗','1000'),option('v2','貓疫苗','0'),option('v3','舊疫苗',''));
 select.value='犬疫苗';c.applyVaccineFee20261026();assert.equal(get('vacServiceFee').value,'1000');
 get('vacServiceFee').value='800';c.updateVaccineFeeHint20261026();assert.match(get('vaccineFeeHint20261026').textContent,/本次已調整/);assert.equal(select.options[0].dataset.defaultFee,'1000');
 select.value='貓疫苗';c.applyVaccineFee20261026();assert.equal(get('vacServiceFee').value,'0','explicit free is preserved');
 select.value='舊疫苗';c.applyVaccineFee20261026();assert.equal(get('vacServiceFee').value,'','unset never becomes free or previous vaccine price');
 c.vaccineTypesFeeScope20261026='B|u';select.value='犬疫苗';c.applyVaccineFee20261026();assert.equal(get('vacServiceFee').value,'','cross-tenant defaults never apply');c.vaccineTypesFeeScope20261026='A|u';
 const panel=get('vaccineFeeSettings20261026');panel.open=true;c.vaccineTypesFeeRows20261026=[{id:'v1',name:'犬疫苗',target:'犬',default_fee:1000}];
 c.renderVaccineFeeSettings20261026();const row=get('vaccineFeeEditor20261026').children[0];row.children[1].value='900';
 get('vacServiceFee').value='800';await row.children[2].onclick();assert.equal(writes.length,1);assert.equal(writes[0].payload.default_fee,900);assert(writes[0].filters.some(x=>x[0]==='tenant_id'&&x[1]==='A'));assert(writes[0].filters.some(x=>x[0]==='default_fee'&&x[1]===1000));
 assert.equal(get('vacServiceFee').value,'800','catalog changes do not rewrite active charge');assert.equal(select.options[0].dataset.defaultFee,'900');c.applyVaccineFee20261026();assert.equal(get('vacServiceFee').value,'900');
 c.CURRENT_PROFILE={role:'doctor'};c.renderVaccineFeeSettings20261026();assert.equal(panel.hidden,true);await row.children[2].onclick();assert.equal(writes.length,1,'doctor cannot write standard prices');
 const base=fs.readFileSync('assets/frontend/index/block-01.js','utf8');const saved=base.slice(base.indexOf('async function recordPetVaccine('),base.indexOf('function syncMedicalHistoryButton('));
 let id=0,stored=[],inserted=0,returns=0;const chargeContext={vaccineRecordSaveBusy:false,CURRENT_TENANT_ID:'A',document:{getElementById:get},alert(){},
 collectRabiesDetails:async()=>null,prepareServiceCharge:(field,pet,kind,name)=>({id:++id,amount:Number(get(field).value),pet,kind,name}),
 _supabase:{from:()=>({insert(){inserted++;return this},select(){return this},async single(){return {data:{id:'record'}}}})},
 finishServiceCharge:(charge,rid)=>stored.push({...charge,recordId:rid}),cancelServiceCharge(){},clearRabiesFields(){},loadPetVaccines:async()=>{},backToMedicalFromVaccine:()=>returns++};
 get('selectedVacPetId').value='pet';select.value='犬疫苗';get('vacAdministeredDate').value='2026-10-26';get('vacNextDueDate').value='2027-10-26';get('vacServiceFee').value='800';
 vm.createContext(chargeContext);vm.runInContext(saved,chargeContext);await Promise.all([chargeContext.recordPetVaccine(true),chargeContext.recordPetVaccine(true)]);
 assert.equal(inserted,1);assert.equal(stored.length,1);assert.equal(stored[0].amount,800);assert.equal(returns,1);assert.equal(get('vacServiceFee').value,'');
 console.log('PASS vaccine fees: standard/discount/free/unset; tenant isolation; admin-only CAS update; current charge preserved; actual discounted fee saved once; return to medical');
})().catch(e=>{console.error(e);process.exit(1)});
