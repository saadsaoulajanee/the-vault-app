export default {async fetch(request, env) {
 const origin=request.headers.get("Origin");
 const allowed=env.ALLOWED_ORIGIN || "https://saadsaoulajanee.github.io";
 const headers={"Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin && origin!==allowed)return reply({error:"Origin not allowed"},403);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return reply({error:"POST required"},405);
 if(!env.VAULT_ACCESS_TOKEN || request.headers.get("Authorization")!=="Bearer "+env.VAULT_ACCESS_TOKEN)return reply({error:"Invalid access token"},401);
 let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
 const {guests,topic,style,language}=body;
 if(!Array.isArray(guests)||!guests.length||guests.length>20||JSON.stringify(body).length>20000)return reply({error:"Invalid request"},400);
 const count=Math.max(1,Math.min(300,Math.floor(Number(body.count)||30)));
 const compact=guests.map(g=>({name:String(g.name||"").slice(0,120),credits:String(g.credits||"").slice(0,500)}));
 const messages=[{role:"system",content:"Write concise, varied celebrity interview questions. Use supplied facts only; do not invent roles or credits. One question per line, no numbering, headings or commentary. Aim for 8–15 words each."},{role:"user",content:JSON.stringify({count,guests:compact,topic:String(topic||"").slice(0,300),style:String(style||"").slice(0,200),language:String(language||"English").slice(0,40)})}];
 const providers=[{name:"Groq",key:env.GROQ_API_KEY,url:"https://api.groq.com/openai/v1/chat/completions",model:env.GROQ_MODEL||"llama-3.1-8b-instant"},{name:"OpenRouter",key:env.OPENROUTER_API_KEY,url:"https://openrouter.ai/api/v1/chat/completions",model:"openrouter/free"}];
 const errors=[];
 for(const p of providers){if(!p.key)continue;try{
 const r=await fetch(p.url,{method:"POST",headers:{"Authorization":"Bearer "+p.key,"Content-Type":"application/json"},body:JSON.stringify({model:p.model,messages,temperature:0.8,max_tokens:Math.min(5400,count*18+60)})});
 if(!r.ok){errors.push(p.name+" HTTP "+r.status+(r.headers.get("retry-after")?" (retry after "+r.headers.get("retry-after")+" seconds)":""));continue;}
 const j=await r.json();const raw=j.choices?.[0]?.message?.content||"";
 const questions=raw.split(/\r?\n/).map(q=>q.trim().replace(/^\s*(?:\d+[.)]\s*|[-*•]\s+)/,"")).filter(q=>q.endsWith("?")).slice(0,count);
 if(questions.length)return reply({questions,provider:p.name,usage:j.usage||null,version:2});
 errors.push(p.name+" returned no questions");break;
 }catch{errors.push(p.name+" connection error");}}
 return reply({error:errors.join("; ")||"No provider configured",version:2},503);
}};