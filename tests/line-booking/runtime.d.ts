declare const Deno: { env: {get(k:string): string|undefined};serve(handler:(req:Request)=>Promise<Response>):void };
declare const EdgeRuntime: {waitUntil(p:Promise<unknown>):void};
