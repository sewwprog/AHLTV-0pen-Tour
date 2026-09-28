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
const matchForm=$("#matchForm"),matchTournament=$("#matchTournament"),bracketTournament=$("#bracketTournament"),generateBracketBtn=$("#generateBracketBtn"),bracketMessage=$("#bracketMessage"),approvedTeams=$("#approvedTeams"),matchMessage=$("#matchMessage"),adminMatchesList=$("#adminMatchesList"),adminMatchesCount=$("#adminMatchesCount");

let tournaments=[],registrations=[],editingTournamentId=null,tabsReady=false,siteSettings=null,siteLogoRemoved=false;

function setButtonContent(button,icon,label){
  if(!button)return;
  button.innerHTML=`<i data-lucide="${icon}"></i><span>${label}</span>`;
  window.refreshIcons?.();
}

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
    rules_text:d.rules_text.trim()||null,
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
  setButtonContent(saveTournamentBtn,"plus","Створити турнір");cancelTournamentEdit.classList.add("hidden");tournamentFormTitle.textContent="ДОДАТИ ТУРНІР";tournamentMessage.textContent="";
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
        <button class="btn" data-edit-tournament="${t.id}"><i data-lucide="pencil"></i><span>Редагувати</span></button>
        <button class="btn" data-toggle-registration="${t.id}"><i data-lucide="${t.registration_open?"x-circle":"check"}"></i><span>${t.registration_open?"Закрити реєстрацію":"Відкрити реєстрацію"}</span></button>
        <button class="btn" data-toggle-visible="${t.id}"><i data-lucide="${t.is_visible?"eye-off":"eye"}"></i><span>${t.is_visible?"Сховати":"Показати"}</span></button>
        <button class="btn reject" data-delete-tournament="${t.id}"><i data-lucide="trash-2"></i><span>Видалити</span></button>
      </div>
    </article>`;
  }).join("");

  window.refreshIcons?.();
  tournamentList.querySelectorAll("[data-status-id]").forEach(el=>el.addEventListener("change",async()=>{
    await supabase.from("tournaments").update({status:el.value}).eq("id",Number(el.dataset.statusId));await loadTournaments();
  }));
  tournamentList.querySelectorAll("[data-edit-tournament]").forEach(btn=>btn.addEventListener("click",()=>{
    const t=tournaments.find(x=>x.id===Number(btn.dataset.editTournament));if(!t)return;
    editingTournamentId=t.id;const f=tournamentForm.elements;
    f.name.value=t.name;f.short_name.value=t.short_name||"";f.description.value=t.description||"";f.rules_text.value=t.rules_text||"";f.game.value=t.game;f.format.value=t.format;f.max_teams.value=t.max_teams;f.status.value=t.status;f.registration_open.checked=t.registration_open;f.is_visible.checked=t.is_visible;
    f.starts_at.value=t.starts_at?new Date(new Date(t.starts_at).getTime()-new Date(t.starts_at).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
    if(tournamentLogoFile)tournamentLogoFile.value="";
    previewImage(tournamentLogoPreview,t.logo_url,t.short_name||t.name||"A");
    setButtonContent(saveTournamentBtn,"save","Зберегти зміни");cancelTournamentEdit.classList.remove("hidden");tournamentFormTitle.textContent="РЕДАГУВАТИ ТУРНІР";tournamentForm.scrollIntoView({behavior:"smooth",block:"start"});
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
  const options=tournaments.length
    ? '<option value="">Обери турнір</option>'+tournaments.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")
    : '<option value="">Спочатку створи турнір</option>';

  matchTournament.innerHTML=options;
  if(bracketTournament)bracketTournament.innerHTML=options;
  refreshApprovedTeams();
}
matchTournament.addEventListener("change",refreshApprovedTeams);
bracketTournament?.addEventListener("change",()=>{
  if(bracketTournament.value){
    matchTournament.value=bracketTournament.value;
    refreshApprovedTeams();
  }
});
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
  window.refreshIcons?.();
  applications.querySelectorAll("[data-app-action]").forEach(btn=>btn.addEventListener("click",handleApplicationAction));
  refreshApprovedTeams();renderTournaments();
}

function renderApplication(item){
  const profile=safeUrl(item.captain_profile);
  const players=Array.isArray(item.players)?item.players:[];
  const playerSteam=Array.isArray(item.player_steam_links)?item.player_steam_links:[];
  const substitutes=Array.isArray(item.substitutes)?item.substitutes:[];
  const substituteSteam=Array.isArray(item.substitute_steam_links)?item.substitute_steam_links:[];

  const rosterHtml=players.map((nick,index)=>{
    const steam=safeUrl(playerSteam[index]);
    return `<div class="admin-roster-row">
      <span class="admin-roster-role">P${index+1}</span>
      <b>${esc(nick)}</b>
      ${steam?`<a href="${esc(steam)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i> Steam</a>`:"<span>—</span>"}
    </div>`;
  }).join("");

  const subsHtml=substitutes.map((nick,index)=>{
    const steam=safeUrl(substituteSteam[index]);
    return `<div class="admin-roster-row substitute">
      <span class="admin-roster-role">S${index+1}</span>
      <b>${esc(nick)}</b>
      ${steam?`<a href="${esc(steam)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link"></i> Steam</a>`:"<span>—</span>"}
    </div>`;
  }).join("");

  return `<article class="application">
    <div class="application-head"><div><small>${esc(item.tournaments?.name||"Турнір")}</small><h3>${esc(item.team_name)} <span class="muted">[${esc(item.team_tag)}]</span></h3><div class="meta">#${item.id} · ${new Date(item.created_at).toLocaleString("uk-UA")}</div></div><span class="pill">${esc(item.status)}</span></div>
    <div class="application-grid"><div><span>Капітан:</span> ${esc(item.captain_nick)}</div><div><span>Email:</span> ${esc(item.captain_email)}</div><div><span>Контакт:</span> ${esc(item.contact)}</div><div><span>Профіль:</span> ${profile?'<a href="'+esc(profile)+'" target="_blank" rel="noopener noreferrer">відкрити</a>':"—"}</div></div>
    <div class="admin-roster-block">
      <div class="admin-roster-title"><b>Основний склад</b><span>5 гравців</span></div>
      ${rosterHtml}
      <div class="admin-roster-title subs"><b>Заміни</b><span>${substitutes.length}</span></div>
      ${subsHtml}
    </div>
    ${item.note?`<div class="players"><b>Коментар:</b> ${esc(item.note)}</div>`:""}
    <div class="card-actions"><button class="btn approve" data-app-action="approved" data-id="${item.id}"><i data-lucide="check"></i><span>Підтвердити</span></button><button class="btn reject" data-app-action="rejected" data-id="${item.id}"><i data-lucide="x-circle"></i><span>Відхилити</span></button><button class="btn" data-app-action="pending" data-id="${item.id}"><i data-lucide="clock-3"></i><span>Pending</span></button><button class="btn" data-app-action="delete" data-id="${item.id}"><i data-lucide="trash-2"></i><span>Видалити</span></button></div>
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
    usersList.innerHTML=data.users.length?data.users.map(u=>`<div class="user-row"><div class="user-email"><b>${esc(u.email||"Без email")}</b><small>${new Date(u.created_at).toLocaleString("uk-UA")}${u.is_self?" · це ви":""}</small></div><span class="role-badge ${u.is_admin?"admin":""}">${u.is_admin?"ADMIN":"USER"}</span><button class="btn ${u.is_admin?"reject":"approve"} user-action" data-user-id="${u.id}" data-make-admin="${u.is_admin?"false":"true"}"><i data-lucide="${u.is_admin?"user-x":"user-check"}"></i><span>${u.is_admin?"Забрати адмінку":"Дати адмінку"}</span></button></div>`).join(""):'<div class="empty-state">Акаунтів немає.</div>';
    window.refreshIcons?.();
    usersList.querySelectorAll("[data-user-id]").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;try{await usersRequest("POST",{user_id:btn.dataset.userId,make_admin:btn.dataset.makeAdmin==="true"});await loadUsers()}catch(e){alert(e.code==="last_admin"?"Не можна забрати права в останнього адміністратора.":"Не вдалося змінити права.");btn.disabled=false}}));
  }catch(e){console.error(e);usersList.innerHTML='<div class="empty-state error">Не вдалося завантажити користувачів.</div>'}
}

function bracketRoundName(round,totalRounds){
  if(round===totalRounds)return "Final";
  if(round===totalRounds-1)return "Semifinal";
  if(round===totalRounds-2&&totalRounds>=3)return "Quarterfinal";
  return "Round "+round;
}

async function advanceWinner(match,winner){
  if(!match.bracket_round||!match.bracket_position||!winner||winner==="TBD"||winner==="BYE")return;

  const nextRound=match.bracket_round+1;
  const nextPosition=Math.ceil(match.bracket_position/2);

  const {data:nextMatch}=await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id",match.tournament_id)
    .eq("bracket_round",nextRound)
    .eq("bracket_position",nextPosition)
    .maybeSingle();

  if(!nextMatch)return;

  const field=match.bracket_position%2===1?"team_one":"team_two";
  await supabase
    .from("tournament_matches")
    .update({[field]:winner})
    .eq("id",nextMatch.id);
}

generateBracketBtn?.addEventListener("click",async()=>{
  const tournamentId=Number(bracketTournament?.value||0);
  bracketMessage.className="";

  if(!tournamentId){
    bracketMessage.textContent="Обери турнір.";
    bracketMessage.className="error";
    return;
  }

  const teams=registrations
    .filter(r=>r.tournament_id===tournamentId&&r.status==="approved")
    .map(r=>r.team_name);

  if(teams.length<2){
    bracketMessage.textContent="Потрібно щонайменше 2 підтверджені команди.";
    bracketMessage.className="error";
    return;
  }

  if(!confirm("Створити нову сітку? Старі матчі сітки цього турніру будуть видалені."))return;

  generateBracketBtn.disabled=true;
  bracketMessage.textContent="Створюємо сітку...";

  try{
    await supabase
      .from("tournament_matches")
      .delete()
      .eq("tournament_id",tournamentId)
      .not("bracket_round","is",null);

    let size=1;
    while(size<teams.length)size*=2;
    const totalRounds=Math.log2(size);
    const seeded=[...teams];
    while(seeded.length<size)seeded.push("BYE");

    const rows=[];

    for(let round=1;round<=totalRounds;round++){
      const matchCount=size/Math.pow(2,round);

      for(let position=1;position<=matchCount;position++){
        let teamOne="TBD";
        let teamTwo="TBD";

        if(round===1){
          teamOne=seeded[(position-1)*2]||"BYE";
          teamTwo=seeded[(position-1)*2+1]||"BYE";
        }

        rows.push({
          tournament_id:tournamentId,
          team_one:teamOne,
          team_two:teamTwo,
          stage:bracketRoundName(round,totalRounds),
          best_of:3,
          status:"scheduled",
          bracket_round:round,
          bracket_position:position,
          is_visible:true
        });
      }
    }

    const {data:created,error}=await supabase
      .from("tournament_matches")
      .insert(rows)
      .select("*");

    if(error)throw error;

    const firstRound=(created||[]).filter(m=>m.bracket_round===1);

    for(const match of firstRound){
      const oneBye=match.team_one==="BYE";
      const twoBye=match.team_two==="BYE";

      if(oneBye!==twoBye){
        const winner=oneBye?match.team_two:match.team_one;
        await supabase
          .from("tournament_matches")
          .update({
            status:"finished",
            team_one_score:oneBye?0:1,
            team_two_score:twoBye?0:1
          })
          .eq("id",match.id);

        await advanceWinner(match,winner);
      }
    }

    bracketMessage.textContent="Сітку створено.";
    bracketMessage.className="success";
    await loadMatches();
  }catch(error){
    console.error(error);
    bracketMessage.textContent="Не вдалося створити сітку.";
    bracketMessage.className="error";
  }finally{
    generateBracketBtn.disabled=false;
  }
});

matchForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(matchForm).entries());

  if(!d.tournament_id){
    matchMessage.textContent="Обери турнір.";
    matchMessage.className="error";
    return;
  }

  const payload={
    tournament_id:Number(d.tournament_id),
    team_one:d.team_one.trim(),
    team_two:d.team_two.trim(),
    starts_at:d.starts_at?new Date(d.starts_at).toISOString():null,
    stage:d.stage.trim()||null,
    best_of:Number(d.best_of),
    status:d.status,
    bracket_round:d.bracket_round?Number(d.bracket_round):null,
    bracket_position:d.bracket_position?Number(d.bracket_position):null,
    team_one_score:d.team_one_score!==""?Number(d.team_one_score):null,
    team_two_score:d.team_two_score!==""?Number(d.team_two_score):null
  };

  matchMessage.textContent="Додаємо...";
  matchMessage.className="";

  const {error}=await supabase.from("tournament_matches").insert(payload);

  if(error){
    console.error(error);
    matchMessage.textContent="Не вдалося додати матч.";
    matchMessage.className="error";
    return;
  }

  matchForm.reset();
  matchMessage.textContent="Матч додано.";
  matchMessage.className="success";
  populateTournamentSelects();
  await loadMatches();
});

async function saveBracketMatch(row){
  const id=Number(row.dataset.matchId);
  const match=currentMatches.find(m=>m.id===id);
  if(!match)return;

  const scoreOneRaw=row.querySelector("[data-score-one]").value;
  const scoreTwoRaw=row.querySelector("[data-score-two]").value;
  const status=row.querySelector("[data-match-status-select]").value;

  const scoreOne=scoreOneRaw===""?null:Number(scoreOneRaw);
  const scoreTwo=scoreTwoRaw===""?null:Number(scoreTwoRaw);

  const {error}=await supabase
    .from("tournament_matches")
    .update({
      team_one_score:scoreOne,
      team_two_score:scoreTwo,
      status
    })
    .eq("id",id);

  if(error){
    alert("Не вдалося зберегти матч.");
    return;
  }

  if(status==="finished"&&scoreOne!==null&&scoreTwo!==null&&scoreOne!==scoreTwo){
    const winner=scoreOne>scoreTwo?match.team_one:match.team_two;
    await advanceWinner(match,winner);
  }

  await loadMatches();
}

let currentMatches=[];

async function loadMatches(){
  const {data,error}=await supabase
    .from("tournament_matches")
    .select("*, tournaments(name)")
    .order("tournament_id",{ascending:true})
    .order("bracket_round",{ascending:true,nullsFirst:false})
    .order("bracket_position",{ascending:true,nullsFirst:false})
    .order("starts_at",{ascending:true,nullsFirst:false});

  if(error){
    adminMatchesList.innerHTML='<div class="empty-state error">Не вдалося завантажити матчі.</div>';
    return;
  }

  currentMatches=data||[];
  adminMatchesCount.textContent=String(currentMatches.length);

  adminMatchesList.innerHTML=currentMatches.length
    ? currentMatches.map(m=>`<div class="admin-match-row bracket-admin-row" data-match-id="${m.id}">
        <div>
          <small>${esc(m.tournaments?.name||"Турнір")} · ${esc(m.stage||"Матч")} ${m.bracket_round?"· R"+m.bracket_round+" #"+m.bracket_position:""}</small>
          <b>${esc(m.team_one)} — ${esc(m.team_two)}</b>
          <span>${m.starts_at?new Date(m.starts_at).toLocaleString("uk-UA"):"Дата не вказана"} · BO${m.best_of}</span>
        </div>
        <div class="bracket-admin-controls">
          <input data-score-one type="number" min="0" value="${m.team_one_score??""}" placeholder="0" aria-label="Рахунок команди 1">
          <span>:</span>
          <input data-score-two type="number" min="0" value="${m.team_two_score??""}" placeholder="0" aria-label="Рахунок команди 2">
          <select data-match-status-select>
            <option value="scheduled" ${m.status==="scheduled"?"selected":""}>Scheduled</option>
            <option value="live" ${m.status==="live"?"selected":""}>LIVE</option>
            <option value="finished" ${m.status==="finished"?"selected":""}>Finished</option>
          </select>
          <button class="btn approve" data-save-match type="button"><i data-lucide="save"></i><span>Зберегти</span></button>
          <button class="btn reject" data-delete-match="${m.id}" type="button"><i data-lucide="trash-2"></i><span>Видалити</span></button>
        </div>
      </div>`).join("")
    : '<div class="empty-state">Матчів ще немає.</div>';

  window.refreshIcons?.();
  adminMatchesList.querySelectorAll("[data-save-match]").forEach(btn=>{
    btn.addEventListener("click",()=>saveBracketMatch(btn.closest("[data-match-id]")));
  });

  adminMatchesList.querySelectorAll("[data-delete-match]").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      if(!confirm("Видалити матч?"))return;
      await supabase.from("tournament_matches").delete().eq("id",Number(btn.dataset.deleteMatch));
      await loadMatches();
    });
  });
}

async function getAdminState(){
  const {data,error}=await supabase.rpc("has_ahltv_admin");
  return error?true:!!data;
}

async function registerConfirmedUser(email,password){
  const response=await fetch(SUPABASE_URL+"/functions/v1/register-user",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password})
  });

  const result=await response.json().catch(()=>({}));

  if(!response.ok){
    const error=new Error(result.error||"registration_failed");
    error.code=result.error||"registration_failed";
    throw error;
  }

  return result;
}

async function signInAccount(email,password){
  let attempt=await supabase.auth.signInWithPassword({email,password});

  if(!attempt.error){
    return attempt;
  }

  const message=String(attempt.error.message||"").toLowerCase();
  const emailNotConfirmed=
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed") ||
    message.includes("not confirmed");

  if(emailNotConfirmed){
    try{
      await registerConfirmedUser(email,password);
    }catch(error){
      if(error.code!=="user_exists")throw error;
    }

    attempt=await supabase.auth.signInWithPassword({email,password});
  }

  return attempt;
}

function updateAuthMode(mode){
  authMode=mode;
  document.querySelectorAll("[data-auth-mode]").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.authMode===mode);
  });

  const authBtn=$("#authBtn");
  const password=$("#password");

  if(authBtn)setButtonContent(authBtn,mode==="register"?"user-plus":"log-in",mode==="register"?"Створити акаунт":"Увійти");
  if(password)password.autocomplete=mode==="register"?"new-password":"current-password";

  loginMessage.textContent="";
  loginMessage.className="";
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

  if(password.length<6){
    loginMessage.textContent="Пароль має містити щонайменше 6 символів.";
    loginMessage.className="error";
    return;
  }

  if(authMode==="register"){
    const hasAdmin=await getAdminState();

    try{
      if(!hasAdmin){
        const response=await fetch(SUPABASE_URL+"/functions/v1/register-first-admin",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({email,password})
        });

        const result=await response.json().catch(()=>({}));

        if(!response.ok){
          throw Object.assign(new Error(result.error||"registration_failed"),{
            code:result.error||"registration_failed"
          });
        }
      }else{
        await registerConfirmedUser(email,password);
      }
    }catch(error){
      if(error.code==="user_exists"){
        loginMessage.textContent="Такий акаунт уже існує. Спробуй увійти.";
        loginMessage.className="error";
        updateAuthMode("login");
        return;
      }

      if(error.code==="invalid_email"){
        loginMessage.textContent="Перевір правильність email.";
      }else if(error.code==="invalid_password"){
        loginMessage.textContent="Пароль має містити щонайменше 6 символів.";
      }else{
        loginMessage.textContent="Не вдалося створити акаунт.";
      }

      loginMessage.className="error";
      return;
    }

    const signIn=await signInAccount(email,password);

    if(signIn.error){
      loginMessage.textContent="Акаунт створено, але вхід не вдався. Спробуй увійти ще раз.";
      loginMessage.className="error";
      updateAuthMode("login");
      return;
    }

    await openAccount(signIn.data.user);
    return;
  }

  let signIn;

  try{
    signIn=await signInAccount(email,password);
  }catch(error){
    console.error(error);
    loginMessage.textContent="Не вдалося виконати вхід. Спробуй ще раз.";
    loginMessage.className="error";
    return;
  }

  if(signIn.error){
    loginMessage.textContent="Невірний email або пароль.";
    loginMessage.className="error";
    return;
  }

  await openAccount(signIn.data.user);
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
