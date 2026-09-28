import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL="https://hfxzdifqcjbslmxffvlf.supabase.co";
const SUPABASE_KEY="sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi";
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const body=document.body;
const menuBtn=document.querySelector("#menuBtn");
const drawer=document.querySelector("#mobileDrawer");
const backdrop=document.querySelector("#drawerBackdrop");
const closeBtn=document.querySelector("#drawerClose");

function setDrawer(open){
  body.classList.toggle("drawer-open",open);
  drawer?.setAttribute("aria-hidden",open?"false":"true");
  menuBtn?.setAttribute("aria-expanded",open?"true":"false");
}

menuBtn?.addEventListener("click",()=>setDrawer(true));
closeBtn?.addEventListener("click",()=>setDrawer(false));
backdrop?.addEventListener("click",()=>setDrawer(false));
drawer?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>setDrawer(false)));
document.addEventListener("keydown",e=>{if(e.key==="Escape")setDrawer(false)});

function safeHttpUrl(value){
  if(!value)return null;
  try{
    const url=new URL(value);
    return ["http:","https:"].includes(url.protocol)?url.href:null;
  }catch{
    return null;
  }
}

function setBrandMark(element,logoUrl,fallback){
  if(!element)return;
  element.innerHTML="";
  const safe=safeHttpUrl(logoUrl);

  if(safe){
    const img=document.createElement("img");
    img.src=safe;
    img.alt="Site logo";
    img.loading="eager";
    element.classList.add("has-image");
    element.appendChild(img);
    return;
  }

  element.classList.remove("has-image");
  element.textContent=(fallback||"A").trim().slice(0,1).toUpperCase()||"A";
}

async function loadSiteBranding(){
  const {data,error}=await supabase
    .from("site_settings")
    .select("*")
    .eq("id",1)
    .maybeSingle();

  if(error||!data)return;

  document.querySelectorAll(".brand-mark").forEach(el=>setBrandMark(el,data.logo_url,data.site_name));

  document.querySelectorAll(".brand-copy strong").forEach(el=>{
    el.textContent=data.site_name||"AHLTV";
  });

  document.querySelectorAll(".brand-copy small").forEach(el=>{
    if(el.textContent.trim().toUpperCase()!=="ADMIN"){
      el.textContent=data.site_subtitle||"";
    }
  });

  const homeTitle=document.querySelector("#homeTitle");
  const homeDescription=document.querySelector("#homeDescription");
  const footerText=document.querySelector("#siteFooterText");
  const copyright=document.querySelector("#siteCopyright");

  if(homeTitle)homeTitle.textContent=data.home_title||"Турніри";
  if(homeDescription)homeDescription.textContent=data.home_description||"";
  if(footerText)footerText.textContent=data.footer_text||"";
  if(copyright)copyright.textContent="© 2026 "+(data.site_name||"AHLTV");

  if(data.site_name&&document.title.startsWith("AHLTV")){
    document.title=data.site_name+document.title.slice(5);
  }

  const logo=safeHttpUrl(data.logo_url);
  if(logo){
    let icon=document.querySelector('link[rel="icon"]');
    if(!icon){
      icon=document.createElement("link");
      icon.rel="icon";
      document.head.appendChild(icon);
    }
    icon.href=logo;
  }
}

loadSiteBranding();
