import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
const SUPABASE_URL="https://hfxzdifqcjbslmxffvlf.supabase.co";
const SUPABASE_KEY="sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi";
const USERS_URL=SUPABASE_URL+"/functions/v1/admin-users";
const ASSET_BUCKET="ahltv-assets";
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY);

const $=s=>document.querySelector(s);
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeUrl=v=>{try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:null}catch{return null}};
const statusLabel=s=>({upcoming:"UPCOMING",registration:"REGISTRATION",live:"LIVE",finished:"FINISHED"}[s]||String(s).toUpperCase());

function previewImage(container,url,fallback="A"){
  if(!container)return;
  container.innerHTML="";
  const safe=safeUrl(url);
  if(safe){
    const img=document.createElement("img");
    img.src=safe;
    img.alt="Logo preview";
    container.classList.add("has-image");
    container.appendChild(img);
  }else{
    container.classList.remove("has-image");
    const span=document.createElement("span");
    span.textContent=(fallback||"A").slice(0,1).toUpperCase();
    container.appendChild(span);
  }
}

async function uploadAsset(file,folder){
  if(!file)return null;
  if(file.size>5*1024*1024)throw new Error("Файл завеликий. Максимум 5 МБ.");
  if(!file.type.startsWith("image/"))throw new Error("Можна завантажувати тільки зображення.");

  const ext=(file.name.split(".").pop()||"img").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8)||"img";
  const path=`${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const {error}=await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});

  if(error)throw error;

  const {data}=supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const loginView=$("#loginView"),userView=$("#userView"),dashboardView=$("#dashboardView"),loginForm=$("#loginForm"),loginMessage=$("#loginMessage"),adminEmail=$("#adminEmail"),userEmail=$("#userEmail"),userLogoutBtn=$("#userLogoutBtn");
const nextParam=new URLSearchParams(location.search).get("next");
const safeNext=nextParam&&/^apply\.html(?:\?.*)?$/.test(nextParam)?nextParam:null;
let authMode="login";
const siteSettingsForm=$("#siteSettingsForm"),siteLogoFile=$("#siteLogoFile"),siteLogoPreview=$("#siteLogoPreview"),siteSettingsMessage=$("#siteSettingsMessage"),saveSiteSettingsBtn=$("#saveSiteSettingsBtn"),removeSiteLogo=$("#removeSiteLogo");
const tournamentForm=$("#tournamentForm"),tournamentList=$("#tournamentsAdminList"),tournamentMessage=$("#tournamentMessage"),saveTournamentBtn=$("#saveTournamentBtn"),cancelTournamentEdit=$("#cancelTournamentEdit"),tournamentFormTitle=$("#tournamentFormTitle"),tournamentLogoFile=$("#tournamentLogoFile"),tournamentLogoPreview=$("#tournamentLogoPreview");
const applications=$("#applications"),stats=$("#stats"),emptyState=$("#emptyState"),pendingBadge=$("#pendingBadge");
const usersList=$("#usersList"),usersCount=$("#usersCount");
const matchForm=$("#matchForm"),matchTournament=$("#matchTournament"),approvedTeams=$("#approvedTeams"),matchMessage=$("#matchMessage"),adminMatchesList=$("#adminMatchesList"),adminMatchesCount=$("#adminMatchesCount");

let tournaments=[],registrations=[],editingTournamentId=null,tabsReady=false,siteSettings=null,siteLogoRemoved=false;

function showLogin(message=""){
  loginView.classList.remove("hidden");
  userView?.classList.add("hidden");
  dashboardView.classList.add("hidden");
  loginMessage.textContent=message;
}

async function isAdmin(userId){
  const {data,error}=await supabase.from("admin_users").select("user_id").eq("user_id",userId).maybeSingle();
  return !error&&!!data;
}

function setupTabs(){
  if(tabsReady)return;tabsReady=true;
  document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll("[data-tab]").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".admin-tab").forEach(x=>x.classList.add("hidden"));
    btn.classList.add("active");$("#"+btn.dataset.tab).classList.remove("hidden");
  }));
}

async function openAccount(user){
  if(safeNext){
    location.href=safeNext;
    return;
  }

  const admin=await isAdmin(user.id);
  loginView.classList.add("hidden");

  if(!admin){
    dashboardView.classList.add("hidden");
    userView?.classList.remove("hidden");
    if(userEmail)userEmail.textContent=user.email||"";
    return;
  }

  userView?.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  adminEmail.textContent=user.email||"";
  setupTabs();
  await loadSiteSettings();
  await loadTournaments();
  await loadApplications();
  renderTournaments();
  await Promise.all([loadUsers(),loadMatches()]);
}

async function loadSiteSettings(){
  const {data,error}=await supabase.from("site_settings").select("*").eq("id",1).single();
  if(error){
    console.error(error);
    siteSettingsMessage.textContent="Не вдалося завантажити налаштування сайту.";
    siteSettingsMessage.className="error";
    return;
  }

  siteSettings=data;
  const f=siteSettingsForm.elements;
  f.site_name.value=data.site_name||"AHLTV";
  f.site_subtitle.value=data.site_subtitle||"TOURNAMENTS";
  f.home_title.value=data.home_title||"Турніри";
  f.home_description.value=data.home_description||"";
  f.footer_text.value=data.footer_text||"Tournament Platform";
  siteLogoRemoved=false;
  if(siteLogoFile)siteLogoFile.value="";
  previewImage(siteLogoPreview,data.logo_url,data.site_name||"A");
}

siteLogoFile?.addEventListener("change",()=>{
  const file=siteLogoFile.files?.[0];
  siteLogoRemoved=false;
  if(file)previewImage(siteLogoPreview,URL.createObjectURL(file),siteSettingsForm.elements.site_name.value||"A");
});

removeSiteLogo?.addEventListener("click",()=>{
  siteLogoRemoved=true;
  if(siteLogoFile)siteLogoFile.value="";
  previewImage(siteLogoPreview,null,siteSettingsForm.elements.site_name.value||"A");
});

siteSettingsForm?.addEventListener("submit",async e=>{
  e.preventDefault();
  saveSiteSettingsBtn.disabled=true;
  siteSettingsMessage.textContent="Зберігаємо...";
  siteSettingsMessage.className="";

  try{
    const d=Object.fromEntries(new FormData(siteSettingsForm).entries());
    let logoUrl=siteLogoRemoved?null:(siteSettings?.logo_url||null);
    const file=siteLogoFile.files?.[0];

    if(file){
      siteSettingsMessage.textContent="Завантажуємо логотип...";
      logoUrl=await uploadAsset(file,"site");
    }

    const payload={
      site_name:d.site_name.trim(),
      site_subtitle:d.site_subtitle.trim(),
      home_title:d.home_title.trim(),
      home_description:d.home_description.trim(),
      footer_text:d.footer_text.trim(),
      logo_url:logoUrl,
      updated_at:new Date().toISOString()
    };

    const {error}=await supabase.from("site_settings").update(payload).eq("id",1);
    if(error)throw error;

    siteSettingsMessage.textContent="Налаштування сайту збережено.";
    siteSettingsMessage.className="success";
    await loadSiteSettings();
  }catch(error){
    console.error(error);
    siteSettingsMessage.textContent=error?.message||"Не вдалося зберегти налаштування.";
    siteSettingsMessage.className="error";
  }finally{
    saveSiteSettingsBtn.disabled=false;
  }
});

function tournamentPayload(form){
  const d=Object.fromEntries(new FormData(form).entries());
  return {
    name:d.name.trim(),short_name:d.short_name.trim()||null,description:d.description.trim()||null,
    game:d.game.trim(),format:d.format.trim(),max_teams:Number(d.max_teams),status:d.status,
    registration_open:form.elements.registration_open.checked,is_visible:form.elements.is_visible.checked,
    starts_at:d.starts_at?new Date(d.starts_at).toISOString():null
  };
}

function resetTournamentForm(){
  editingTournamentId=null;tournamentForm.reset();
  tournamentForm.elements.game.value="CS2";tournamentForm.elements.format.value="BO3";tournamentForm.elements.max_teams.value="16";
  tournamentForm.elements.status.value="registration";tournamentForm.elements.registration_open.checked=true;tournamentForm.elements.is_visible.checked=true;
  previewImage(tournamentLogoPreview,null,"A");
  saveTournamentBtn.textContent="Створити турнір";cancelTournamentEdit.classList.add("hidden");tournamentFormTitle.textContent="ДОДАТИ ТУРНІР";tournamentMessage.textContent="";
}

tournamentLogoFile?.addEventListener("change",()=>{
  const file=tournamentLogoFile.files?.[0];
  if(file)previewImage(tournamentLogoPreview,URL.createObjectURL(file),tournamentForm.elements.short_name.value||tournamentForm.elements.name.value||"A");
});

tournamentForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const payload=tournamentPayload(tournamentForm);
  const wasEditing=!!editingTournamentId;
  saveTournamentBtn.disabled=true;
  tournamentMessage.textContent="Зберігаємо...";
  tournamentMessage.className="";

  try{
    let saved;

    if(editingTournamentId){
      const {data,error}=await supabase.from("tournaments").update(payload).eq("id",editingTournamentId).select("id,logo_url").single();
      if(error)throw error;
      saved=data;
    }else{
      const {data,error}=await supabase.from("tournaments").insert(payload).select("id,logo_url").single();
      if(error)throw error;
      saved=data;
    }

    const logoFile=tournamentLogoFile.files?.[0];

    if(logoFile){
      tournamentMessage.textContent="Завантажуємо лого...";
      const logoUrl=await uploadAsset(logoFile,`tournaments/${saved.id}`);
      const {error:logoError}=await supabase.from("tournaments").update({logo_url:logoUrl}).eq("id",saved.id);
      if(logoError)throw logoError;
    }

    tournamentMessage.textContent=wasEditing?"Турнір оновлено.":"Турнір створено.";
    tournamentMessage.className="success";
    resetTournamentForm();
    await loadTournaments();
  }catch(error){
    console.error(error);
    tournamentMessage.textContent=error?.message||"Не вдалося зберегти турнір.";
    tournamentMessage.className="error";
  }finally{
    saveTournamentBtn.disabled=false;
  }
});
cancelTournamentEdit.addEventListener("click",resetTournamentForm);

async function loadTournaments(){
  const {data,error}=await supabase.from("tournaments").select("*").order("created_at",{ascending:false});
  if(error){tournamentList.innerHTML='<section class="panel empty error">Не вдалося завантажити турніри.</section>';return}
  tournaments=data||[];renderTournaments();populateTournamentSelects();
}

function renderTournaments(){
  if(!tournaments.length){tournamentList.innerHTML='<section class="panel empty">Турнірів ще немає. Створи перший вище.</section>';return}
  tournamentList.innerHTML=tournaments.map(t=>{
    const approved=registrations.filter(r=>r.tournament_id===t.id&&r.status==="approved").length;
    const logo=safeUrl(t.logo_url);
    return `<article class="panel admin-tournament-card">
      <div class="admin-tournament-main">
        <div class="tournament-icon small ${logo?"has-logo":""}">${logo?`<img src="${esc(logo)}" alt="${esc(t.name)} logo">`:esc((t.short_name||t.name).slice(0,1).toUpperCase())}</div>
        <div><small>${esc(t.game)} · ${esc(t.format)}</small><h3>${esc(t.name)}</h3><p>${approved} / ${t.max_teams} команд · ${t.registration_open?"реєстрація відкрита":"реєстрація закрита"} · ${t.is_visible?"видимий":"прихований"}</p></div>
        <span class="status-badge status-${t.status}">${statusLabel(t.status)}</span>
      </div>
      <div class="admin-tournament-controls">
        <select data-status-id="${t.id}">
          <option value="upcoming" ${t.status==="upcoming"?"selected":""}>Upcoming</option>
          <option value="registration" ${t.status==="registration"?"selected":""}>Registration</option>
          <option value="live" ${t.status==="live"?"selected":""}>Live</option>
          <option value="finished" ${t.status==="finished"?"selected":""}>Finished</option>
        </select>
        <button class="btn" data-edit-tournament="${t.id}">Редагувати</button>
        <button class="btn" data-toggle-registration="${t.id}">${t.registration_open?"Закрити реєстрацію":"Відкрити реєстрацію"}</button>
        <button class="btn" data-toggle-visible="${t.id}">${t.is_visible?"Сховати":"Показати"}</button>
        <button class="btn reject" data-delete-tournament="${t.id}">Видалити</button>
      </div>
    </article>`;
  }).join("");

  tournamentList.querySelectorAll("[data-status-id]").forEach(el=>el.addEventListener("change",async()=>{
    await supabase.from("tournaments").update({status:el.value}).eq("id",Number(el.dataset.statusId));await loadTournaments();
  }));
  tournamentList.querySelectorAll("[data-edit-tournament]").forEach(btn=>btn.addEventListener("click",()=>{
    const t=tournaments.find(x=>x.id===Number(btn.dataset.editTournament));if(!t)return;
    editingTournamentId=t.id;const f=tournamentForm.elements;
    f.name.value=t.name;f.short_name.value=t.short_name||"";f.description.value=t.description||"";f.game.value=t.game;f.format.value=t.format;f.max_teams.value=t.max_teams;f.status.value=t.status;f.registration_open.checked=t.registration_open;f.is_visible.checked=t.is_visible;
    f.starts_at.value=t.starts_at?new Date(new Date(t.starts_at).getTime()-new Date(t.starts_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
    if(tournamentLogoFile)tournamentLogoFile.value="";
    previewImage(tournamentLogoPreview,t.logo_url,t.short_name||t.name||"A");
    saveTournamentBtn.textContent="Зберегти зміни";cancelTournamentEdit.classList.remove("hidden");tournamentFormTitle.textContent="РЕДАГУВАТИ ТУРНІР";tournamentForm.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  tournamentList.querySelectorAll("[data-toggle-registration]").forEach(btn=>btn.addEventListener("click",async()=>{
    const t=tournaments.find(x=>x.id===Number(btn.dataset.toggleRegistration));if(!t)return;
    await supabase.from("tournaments").update({registration_open:!t.registration_open}).eq("id",t.id);await loadTournaments();
  }));
  tournamentList.querySelectorAll("[data-toggle-visible]").forEach(btn=>btn.addEventListener("click",async()=>{
    const t=tournaments.find(x=>x.id===Number(btn.dataset.toggleVisible));if(!t)return;
    await supabase.from("tournaments").update({is_visible:!t.is_visible}).eq("id",t.id);await loadTournaments();
  }));
  tournamentList.querySelectorAll("[data-delete-tournament]").forEach(btn=>btn.addEventListener("click",async()=>{
    const t=tournaments.find(x=>x.id===Number(btn.dataset.deleteTournament));if(!t||!confirm(`Видалити турнір "${t.name}" разом із його заявками та матчами?`))return;
    await supabase.from("tournaments").delete().eq("id",t.id);await Promise.all([loadTournaments(),loadApplications(),loadMatches()]);
  }));
}

function populateTournamentSelects(){
  matchTournament.innerHTML=tournaments.length?'<option value="">Обери турнір</option>'+tournaments.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join(""):'<option value="">Спочатку створи турнір</option>';
  refreshApprovedTeams();
}
matchTournament.addEventListener("change",refreshApprovedTeams);
function refreshApprovedTeams(){
  const id=Number(matchTournament.value);
  approvedTeams.innerHTML=registrations.filter(r=>r.status==="approved"&&r.tournament_id===id).map(r=>`<option value="${esc(r.team_name)}"></option>`).join("");
}

async function loadApplications(){
  const {data,error}=await supabase.from("team_registrations").select("*, tournaments(name,short_name)").order("created_at",{ascending:false});
  if(error){applications.innerHTML='<p class="error">Не вдалося завантажити заявки.</p>';return}
  registrations=data||[];const pending=registrations.filter(x=>x.status==="pending").length,approved=registrations.filter(x=>x.status==="approved").length;
  pendingBadge.textContent=pending?String(pending):"";
  stats.innerHTML=`<div><b>${registrations.length}</b><span>всього</span></div><div><b>${pending}</b><span>очікують</span></div><div><b>${approved}</b><span>підтверджені</span></div>`;
  emptyState.classList.toggle("hidden",registrations.length!==0);
  applications.innerHTML=registrations.map(renderApplication).join("");
  applications.querySelectorAll("[data-app-action]").forEach(btn=>btn.addEventListener("click",handleApplicationAction));
  refreshApprovedTeams();renderTournaments();
}

function renderApplication(item){
  const profile=safeUrl(item.captain_profile),players=Array.isArray(item.players)?item.players:[];
  return `<article class="application">
    <div class="application-head"><div><small>${esc(item.tournaments?.name||"Турнір")}</small><h3>${esc(item.team_name)} <span class="muted">[${esc(item.team_tag)}]</span></h3><div class="meta">#${item.id} · ${new Date(item.created_at).toLocaleString("uk-UA")}</div></div><span class="pill">${esc(item.status)}</span></div>
    <div class="application-grid"><div><span>Капітан:</span> ${esc(item.captain_nick)}</div><div><span>Email:</span> ${esc(item.captain_email)}</div><div><span>Контакт:</span> ${esc(item.contact)}</div><div><span>Профіль:</span> ${profile?'<a href="'+esc(profile)+'" target="_blank" rel="noopener noreferrer">відкрити</a>':"—"}</div></div>
    <div class="players"><b>Склад:</b> ${players.map(esc).join(", ")}${item.substitute?" · Заміна: "+esc(item.substitute):""}${item.note?"<br><b>Коментар:</b> "+esc(item.note):""}</div>
    <div class="card-actions"><button class="btn approve" data-app-action="approved" data-id="${item.id}">Підтвердити</button><button class="btn reject" data-app-action="rejected" data-id="${item.id}">Відхилити</button><button class="btn" data-app-action="pending" data-id="${item.id}">Pending</button><button class="btn" data-app-action="delete" data-id="${item.id}">Видалити</button></div>
  </article>`;
}
async function handleApplicationAction(e){
  const id=Number(e.currentTarget.dataset.id),action=e.currentTarget.dataset.appAction;
  if(action==="delete"){if(!confirm("Видалити заявку?"))return;await supabase.from("team_registrations").delete().eq("id",id)}
  else await supabase.from("team_registrations").update({status:action}).eq("id",id);
  await loadApplications();
}

async function getAccessToken(){const {data:{session}}=await supabase.auth.getSession();return session?.access_token||null}
async function usersRequest(method="GET",body=null){
  const token=await getAccessToken();if(!token)throw new Error("no_session");
  const r=await fetch(USERS_URL,{method,headers:{Authorization:"Bearer "+token,apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(data.error||"request_failed");e.code=data.error;throw e}return data;
}
async function loadUsers(){
  usersList.innerHTML='<div class="empty-state">Завантаження...</div>';
  try{
    const data=await usersRequest();usersCount.textContent=String(data.users.length);
    usersList.innerHTML=data.users.length?data.users.map(u=>`<div class="user-row"><div class="user-email"><b>${esc(u.email||"Без email")}</b><small>${new Date(u.created_at).toLocaleString("uk-UA")}${u.is_self?" · це ви":""}</small></div><span class="role-badge ${u.is_admin?"admin":""}">${u.is_admin?"ADMIN":"USER"}</span><button class="btn ${u.is_admin?"reject":"approve"} user-action" data-user-id="${u.id}" data-make-admin="${u.is_admin?"false":"true"}">${u.is_admin?"Забрати адмінку":"Дати адмінку"}</button></div>`).join(""):'<div class="empty-state">Акаунтів немає.</div>';
    usersList.querySelectorAll("[data-user-id]").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;try{await usersRequest("POST",{user_id:btn.dataset.userId,make_admin:btn.dataset.makeAdmin==="true"});await loadUsers()}catch(e){alert(e.code==="last_admin"?"Не можна забрати права в останнього адміністратора.":"Не вдалося змінити права.");btn.disabled=false}}));
  }catch(e){console.error(e);usersList.innerHTML='<div class="empty-state error">Не вдалося завантажити користувачів.</div>'}
}

matchForm.addEventListener("submit",async e=>{
  e.preventDefault();const d=Object.fromEntries(new FormData(matchForm).entries());
  if(!d.tournament_id){matchMessage.textContent="Обери турнір.";return}
  const payload={tournament_id:Number(d.tournament_id),team_one:d.team_one.trim(),team_two:d.team_two.trim(),starts_at:d.starts_at?new Date(d.starts_at).toISOString():null,stage:d.stage.trim()||null,best_of:Number(d.best_of),status:d.status};
  matchMessage.textContent="Додаємо...";const {error}=await supabase.from("tournament_matches").insert(payload);
  if(error){console.error(error);matchMessage.textContent="Не вдалося додати матч.";matchMessage.className="error";return}
  matchForm.reset();matchMessage.textContent="Матч додано.";matchMessage.className="success";populateTournamentSelects();await loadMatches();
});
async function loadMatches(){
  const {data,error}=await supabase.from("tournament_matches").select("*, tournaments(name)").order("starts_at",{ascending:true,nullsFirst:false}).order("created_at",{ascending:true});
  if(error){adminMatchesList.innerHTML='<div class="empty-state error">Не вдалося завантажити матчі.</div>';return}
  adminMatchesCount.textContent=String(data.length);
  adminMatchesList.innerHTML=data.length?data.map(m=>`<div class="admin-match-row"><div><small>${esc(m.tournaments?.name||"Турнір")}</small><b>${esc(m.team_one)} — ${esc(m.team_two)}</b><span>${m.starts_at?new Date(m.starts_at).toLocaleString("uk-UA"):"Дата не вказана"} · ${esc(m.stage||"без стадії")} · BO${m.best_of} · ${esc(m.status)}</span></div><div class="admin-match-actions"><button class="btn" data-match-status="scheduled" data-id="${m.id}">Scheduled</button><button class="btn reject" data-match-status="live" data-id="${m.id}">LIVE</button><button class="btn approve" data-match-status="finished" data-id="${m.id}">Finished</button><button class="btn" data-delete-match="${m.id}">Видалити</button></div></div>`).join(""):'<div class="empty-state">Матчів ще немає.</div>';
  adminMatchesList.querySelectorAll("[data-match-status]").forEach(btn=>btn.addEventListener("click",async()=>{await supabase.from("tournament_matches").update({status:btn.dataset.matchStatus}).eq("id",Number(btn.dataset.id));await loadMatches()}));
  adminMatchesList.querySelectorAll("[data-delete-match]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("Видалити матч?"))return;await supabase.from("tournament_matches").delete().eq("id",Number(btn.dataset.deleteMatch));await loadMatches()}));
}

async function getAdminState(){
  const {data,error}=await supabase.rpc("has_ahltv_admin");
  return error?true:!!data;
}

function updateAuthMode(mode){
  authMode=mode;
  document.querySelectorAll("[data-auth-mode]").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.authMode===mode);
  });
  const authBtn=$("#authBtn");
  const password=$("#password");
  if(authBtn)authBtn.textContent=mode==="register"?"Створити акаунт":"Увійти";
  if(password)password.autocomplete=mode==="register"?"new-password":"current-password";
  loginMessage.textContent="";
}

document.querySelectorAll("[data-auth-mode]").forEach(btn=>{
  btn.addEventListener("click",()=>updateAuthMode(btn.dataset.authMode));
});

loginForm.addEventListener("submit",async e=>{
  e.preventDefault();

  const email=$("#email").value.trim().toLowerCase();
  const password=$("#password").value;
  loginMessage.className="";
  loginMessage.textContent=authMode==="register"?"Створюємо акаунт...":"Вхід...";

  if(authMode==="register"){
    if(password.length<6){
      loginMessage.textContent="Пароль має містити щонайменше 6 символів.";
      loginMessage.className="error";
      return;
    }

    const hasAdmin=await getAdminState();

    if(!hasAdmin){
      const response=await fetch(SUPABASE_URL+"/functions/v1/register-first-admin",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,password})
      });
      const result=await response.json().catch(()=>({}));

      if(!response.ok){
        loginMessage.textContent=result.error==="admin_exists"
          ?"Головний акаунт уже створений. Спробуй звичайну реєстрацію ще раз."
          :"Не вдалося створити акаунт.";
        loginMessage.className="error";
        return;
      }

      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error){
        loginMessage.textContent="Акаунт створено. Спробуй увійти.";
        updateAuthMode("login");
        return;
      }

      await openAccount(data.user);
      return;
    }

    const {data,error}=await supabase.auth.signUp({email,password});

    if(error){
      loginMessage.textContent=error.message?.toLowerCase().includes("already")
        ?"Такий акаунт уже існує. Увійди."
        :"Не вдалося створити акаунт.";
      loginMessage.className="error";
      return;
    }

    if(data.session?.user){
      await openAccount(data.session.user);
      return;
    }

    const signIn=await supabase.auth.signInWithPassword({email,password});
    if(!signIn.error&&signIn.data.user){
      await openAccount(signIn.data.user);
      return;
    }

    loginMessage.textContent="Акаунт створено. Якщо Supabase попросить підтвердити email, підтвердь його і потім увійди.";
    loginMessage.className="success";
    updateAuthMode("login");
    return;
  }

  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error){
    loginMessage.textContent="Невірний email або пароль.";
    loginMessage.className="error";
    return;
  }

  await openAccount(data.user);
});

$("#logoutBtn")?.addEventListener("click",async()=>{
  await supabase.auth.signOut();
  showLogin();
  updateAuthMode("login");
});

userLogoutBtn?.addEventListener("click",async()=>{
  await supabase.auth.signOut();
  showLogin();
  updateAuthMode("login");
});

const {data:{session}}=await supabase.auth.getSession();

if(session?.user){
  await openAccount(session.user);
}else{
  showLogin();
  updateAuthMode("login");
}
