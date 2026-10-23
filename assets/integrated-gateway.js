/* Install before the SDK. Preserve SDK query/body/header/AbortSignal semantics. */
(()=>{
 'use strict';
 const project=new URL(window.GENBLUE_CONFIG.supabaseUrl);
 const nativeFetch=window.fetch.bind(window);
 window.fetch=function(input,init){
  const isRequest=typeof Request!=='undefined'&&input instanceof Request;
  const url=new URL(isRequest?input.url:String(input),window.location.href);
  if(url.origin!==project.origin)return nativeFetch(input,init);
  if(!/^\/(auth|rest|storage|functions)\/v1\//.test(url.pathname))return Promise.reject(Error('此專案介面尚未接入 Django，請保留畫面並回報。'));
  const local=new URL('/api/supabase'+url.pathname+url.search,window.location.origin).href;
  if(isRequest){
   let request;
   try{request=new Request(input,init);}catch(error){return Promise.reject(error);}
   const options={method:request.method,headers:request.headers,signal:request.signal,credentials:'omit',
    cache:request.cache,redirect:request.redirect,referrer:request.referrer,referrerPolicy:request.referrerPolicy,
    integrity:request.integrity,keepalive:request.keepalive,mode:request.mode};
   if(request.method==='GET'||request.method==='HEAD')return nativeFetch(local,options);
   // Reusing a Request stream at a new URL can emit chunked bodies that the
   // local Django development server cannot read. Preserve bytes explicitly.
   return request.arrayBuffer().then(body=>nativeFetch(local,{...options,body}));
  }
  return nativeFetch(local,{...init,credentials:'omit'});
 };
})();
