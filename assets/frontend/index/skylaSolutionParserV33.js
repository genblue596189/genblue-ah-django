
/* Skyla Solution 01/body/04 parser. Validated against the owner's real capture. */
(function(root){
 'use strict';
 const map={ALB:'alb',TP:'tp',GLU:'glu',CHOL:'chol',ALP:'alp',ALT:'alt',GGT:'ggt',TBIL:'tbil',AMY:'amy',LIPA:'lipa',BUN:'bun',CREA:'crea',CA:'ca',PHOS:'phos','#GLOB':'glob','#UREA':'urea','#C-CA':'c_ca','#A/G':'ag_ratio','#B/C':'bc_ratio'};
 function parse(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(!bytes.length||bytes.length>524288)throw Error('請選擇完整且小於 512 KB 的單份 Skyla 原始報告。');
  if(bytes[0]!==1||bytes[bytes.length-1]!==4)throw Error('缺少 Skyla 開始或結束訊號，未接受不完整報告。');
  let body='';for(let i=1;i<bytes.length-1;i++){
   const b=bytes[i];if(b>126||(b<32&&b!==13&&b!==10))throw Error('收到尚未支援的編碼／封包格式；請保留原始檔供確認。');
   body+=String.fromCharCode(b);
  }
  const lines=body.split('\r\n');
  if(!body.endsWith('\r\n')||lines.some(l=>/[\r\n]/.test(l)))throw Error('報告換行格式不完整。');
  const get=name=>{const hit=lines.filter(l=>l.startsWith(name+' '));if(hit.length!==1)throw Error('報告欄位缺少或重複：'+name);return hit[0].slice(name.length).trim();};
  const model=get('Model Name');if(model.toLowerCase()!=='skyla solution')throw Error('此轉換器目前只接受已測試的 skyla Solution 報告。');
  const dateRows=lines.filter(l=>/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/.test(l));
  if(dateRows.length!==1)throw Error('缺少唯一的原始檢驗日期時間。');
  const [date,time]=dateRows[0].trim().split(/\s+/);
  if(!Number.isFinite(Date.parse(date+'T'+time+'Z'))||new Date(date+'T'+time+'Z').toISOString().slice(0,19)!==date+'T'+time)throw Error('原始檢驗日期時間無效。');
  const speciesRaw=get('Species');const species=({canine:'犬',feline:'貓'})[speciesRaw.toLowerCase()]||'';
  const total=get('Total Number');if(!/^\d+$/.test(total)||Number(total)<1||Number(total)>100)throw Error('檢驗項目數量無效。');
  const start=lines.findIndex(l=>l.startsWith('Total Number '));const resultLines=lines.slice(start+1).filter(l=>l.trim());
  if(resultLines.length!==Number(total))throw Error('項目數量不符，可能是報告不完整；未儲存。');
  const codes=new Set(),keys=new Set();
  const rows=resultLines.map(line=>{
   if(line.length<35)throw Error('檢驗列長度不足：'+line);
   const code=line.slice(0,11).trim();let value=line.slice(11,20).trim(),flag='';
   if(!/^[#A-Za-z0-9\/()-]+$/.test(code))throw Error('尚未支援的檢驗代碼欄位：'+code);
   // Instruments emit both 'h >300' and 'h>300'; retain comparison and direction.
   if(/^[hl]\s*(?=[<>≤≥+\-.\d])/i.test(value)){flag=value[0].toLowerCase();value=value.slice(1).trim();}
   // U is an observed instrument marker, not a synonym for high or low.
   // All analytes share this grammar; preserve the complete marked result.
   const numericPattern=/^[<>≤≥]?\s*[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
   const marked=/^U\s*(.+)$/i.exec(value),numericText=marked?marked[1].trim():value;
   const missingCalculated=value===''&&!flag&&['#GLOB','#UREA','#C-CA','#A/G','#B/C'].includes(code.toUpperCase());
   if(!missingCalculated&&(marked?!numericPattern.test(numericText):!/^(?:[<>≤≥]?\s*[-+]?(?:\d+(?:\.\d*)?|\.\d+)|N\.?A\.?|---|Error)$/i.test(value)))throw Error('無法可靠辨識結果：'+code+' '+value);
   const key=map[code.toUpperCase()]||('skyla_'+code.replace(/[^A-Za-z0-9]/g,'_').toLowerCase());
   if(codes.has(code.toUpperCase())||keys.has(key))throw Error('報告出現重複項目：'+code);codes.add(code.toUpperCase());keys.add(key);
   const reference=line.slice(20,35).trim(),unit=line.slice(35).trim();
   if(reference&&!/^[-+]?\d+(?:\.\d+)?\s*-\s*[-+]?\d+(?:\.\d+)?$/.test(reference))throw Error('參考範圍格式尚未支援：'+code+' '+reference);
   if(marked&&!flag){
    flag='u'; // Review marker when range/direction does not establish high or low.
    const range=/^([-+]?\d+(?:\.\d+)?)\s*-\s*([-+]?\d+(?:\.\d+)?)$/.exec(reference);
    const number=/^([<>≤≥]?)\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(numericText);
    if(range&&number){
     const low=Number(range[1]),high=Number(range[2]),n=Number(number[2]),op=number[1];
     if(low<=high){
      if((!op&&n>high)||(op==='>'&&n>=high)||(op==='≥'&&n>high))flag='h';
      else if((!op&&n<low)||(op==='<'&&n<=low)||(op==='≤'&&n<low))flag='l';
     }
    }
   }
   return {code,key,value,reference,unit,flag,result_marker:marked?'U':'',result_status:missingCalculated?'not_reported':'reported'};
  });
  return {format:'skyla-solution-01-04-v1',model,panel:get('Panel Name'),firmware:get('FW Version'),patient_id:get('Patient ID'),patient_name:get('Patient Name'),owner_name:get('Pet Owner'),species,species_raw:speciesRaw,sample_type:get('Sample Type'),pr_code:get('PR Code'),date,time,total:Number(total),rows,raw_text:body};
 }
 root.SkylaSolutionParser={parse,map};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.SkylaSolutionParser;
})(typeof window==='undefined'?globalThis:window);

