
/* v77: uncompressed Explicit VR Little Endian, single-frame grayscale DICOM. */
function parseDicomV77(buffer){
 const v=new DataView(buffer),bytes=new Uint8Array(buffer),long=new Set(['OB','OD','OF','OL','OV','OW','SQ','UC','UR','UT','UN','SV','UV']);
 const str=(p,n)=>new TextDecoder('ascii').decode(bytes.subarray(p,p+n)).replace(/\0/g,'').trim();
 if(buffer.byteLength<132||str(128,4)!=='DICM')throw Error('不是支援的 DICOM Part 10 檔案。');
 let p=132,pixel=null,syntax='',tags=new Map();
 while(p+8<=buffer.byteLength){
  const g=v.getUint16(p,true),e=v.getUint16(p+2,true),vr=str(p+4,2),wide=long.has(vr),h=wide?12:8;
  if(!/^[A-Z]{2}$/.test(vr)||p+h>buffer.byteLength)throw Error('DICOM 元素格式不符。');
  const n=wide?v.getUint32(p+8,true):v.getUint16(p+6,true),start=p+h;
  if(n===0xffffffff)throw Error('此 DICOM 使用壓縮影像或未定長度序列，此版尚未支援。');
  if(start+n>buffer.byteLength)throw Error('DICOM 檔案不完整。');
  if(g===2&&e===16){syntax=str(start,n);if(syntax!=='1.2.840.10008.1.2.1')throw Error('此版支援未壓縮 Explicit VR Little Endian DICOM；此檔編碼尚未支援。');}
  if(g===0x28)tags.set(e,{vr,start,n});
  if(g===0x7fe0&&e===0x10){pixel={start,n};break;}
  p=start+n;
 }
 const num=(e,fallback)=>{const t=tags.get(e);if(!t)return fallback;if(t.vr==='US'&&t.n===2)return v.getUint16(t.start,true);if(t.vr==='SS'&&t.n===2)return v.getInt16(t.start,true);return Number(str(t.start,t.n).split('\\')[0]);};
 const text=e=>{const t=tags.get(e);return t?str(t.start,t.n):'';};
 const rows=num(16),cols=num(17),bits=num(256),stored=num(257),high=num(258),signed=num(259),samples=num(2),frames=num(8,1),photo=text(4),slope=num(1053,1),intercept=num(1052,0);
 if(syntax!=='1.2.840.10008.1.2.1'||!pixel)throw Error('找不到支援的 DICOM 像素資料。');
 if(frames!==1||samples!==1||!['MONOCHROME1','MONOCHROME2'].includes(photo))throw Error('此版只支援單張灰階 X 光；彩色或多張影像尚未支援。');
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows*cols>16000000||![8,16].includes(bits)||!Number.isInteger(stored)||stored<1||stored>bits||high!==stored-1||![0,1].includes(signed)||!Number.isFinite(slope)||slope===0||!Number.isFinite(intercept))throw Error('DICOM 像素規格尚未支援。');
 if(tags.has(0x3000)||tags.has(0x3010)||tags.has(0x2000)||tags.has(0x1220))throw Error('此檔含灰階／色彩查表，此版尚未支援。');
 const voi=text(0x1056);if(voi&&voi!=='LINEAR')throw Error('此檔的灰階轉換尚未支援。');
 const count=rows*cols,required=count*(bits/8);if(pixel.n!==required+(required%2))throw Error('DICOM 像素長度不符。');
 const values=new Float32Array(count),mask=2**stored-1,sign=2**(stored-1),range=2**stored;
 let lo=Infinity,hi=-Infinity;
 for(let i=0;i<count;i++){let x=(bits===8?bytes[pixel.start+i]:v.getUint16(pixel.start+i*2,true))&mask;if(signed&&x>=sign)x-=range;x=x*slope+intercept;values[i]=x;lo=Math.min(lo,x);hi=Math.max(hi,x);}
 let center=num(1050,NaN),width=num(1051,NaN);const windowed=Number.isFinite(center)&&Number.isFinite(width)&&width>=1;
 const rgba=new Uint8ClampedArray(count*4);
 for(let i=0;i<count;i++){const x=values[i];let y;
  if(windowed)y=width===1?(x>center-.5?255:0):((x-(center-.5))/(width-1)+.5)*255;
  else y=hi>lo?(x-lo)/(hi-lo)*255:0;
  y=Math.max(0,Math.min(255,y));if(photo==='MONOCHROME1')y=255-y;
  const j=i*4;rgba[j]=rgba[j+1]=rgba[j+2]=Math.round(y);rgba[j+3]=255;
 }
 return {rows,cols,rgba,stored,photo};
}
async function convertDicomV77(file){
 if(!file.size||file.size>50*1024*1024)throw Error('DICOM 單檔上限 50 MB。');
 const d=parseDicomV77(await file.arrayBuffer()),canvas=document.createElement('canvas');canvas.width=d.cols;canvas.height=d.rows;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('瀏覽器無法轉換影像。');ctx.putImageData(new ImageData(d.rgba,d.cols,d.rows),0,0);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=canvas.height=0;
 if(!blob||blob.size>50*1024*1024)throw Error('轉換 PNG 失敗或超過 50 MB。');
 return new File([blob],file.name.replace(/\.(dcm|dicom)$/i,'')+'_QR.png',{type:'image/png'});
}
const saveImagingOriginalV77=saveImagingV61;
saveImagingV61=async function(event){
 event?.preventDefault();if(imagingV61.busy)return;
 const input=document.getElementById('im61-file'),file=input.files[0];
 if(imagingV61.draft||!file||!/\.(dcm|dicom)$/i.test(file.name))return saveImagingOriginalV77(event);
 if(!imagingV61.pet){imagingMessageV61('請先選擇寵物。',true);return;}
 if(!document.getElementById('im61-form').reportValidity())return;
 if(document.getElementById('im61-modality').value!=='XRAY'){imagingMessageV61('DICOM 分享請先選擇「X 光」。',true);return;}
 const scope=imagingScopeV61();imagingV61.busy=true;imagingLockV61(true);document.getElementById('im61-save').disabled=true;
 let ready=false;
 try{
  imagingMessageV61('正在將 DICOM 轉成手機可查看的 PNG…請保持頁面開啟。');
  const converted=await convertDicomV77(file);if(scope!==imagingScopeV61())return;
  const transfer=new DataTransfer();transfer.items.add(converted);input.files=transfer.files;ready=true;
 }catch(e){if(scope===imagingScopeV61())imagingMessageV61('DICOM 尚未上傳：'+e.message,true);}
 finally{if(scope===imagingScopeV61()){imagingV61.busy=false;imagingLockV61(false);document.getElementById('im61-save').disabled=false;}}
 if(ready&&scope===imagingScopeV61())return saveImagingOriginalV77(event);
};

