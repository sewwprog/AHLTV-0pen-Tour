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

const loginView=$("#loginView"),userView=$("#userView"),dashboardView=$("#dashboardView"),loginForm=$("#loginForm"),loginMessage=$("#loginMessage"),adminEmail=$("#adminEmail"),userEmail=$("#userEmail"),userLogoutBtn=$("#userLogoutBtn"),userApplications=$("#userApplications"),userApplicationsCount=$("#userApplicationsCount"),userApplicationStats=$("#userApplicationStats");
const nextParam=new URLSearchParams(location.search).get("next");
const safeNext=nextParam&&/^apply\.html(?:\?.*)?$/.test(nextParam)?nextParam:null;
let authMode="login";
const siteSettingsForm=$("#siteSettingsForm"),siteLogoFile=$("#siteLogoFile"),siteLogoPreview=$("#siteLogoPreview"),siteSettingsMessage=$("#siteSettingsMessage"),saveSiteSettingsBtn=$("#saveSiteSettingsBtn"),removeSiteLogo=$("#removeSiteLogo");
const tournamentForm=$("#tournamentForm"),tournamentList=$("#tournamentsAdminList"),tournamentMessage=$("#tournamentMessage"),saveTournamentBtn=$("#saveTournamentBtn"),cancelTournamentEdit=$("#cancelTournamentEdit"),tournamentFormTitle=$("#tournamentFormTitle"),tournamentLogoFile=$("#tournamentLogoFile"),tournamentLogoPreview=$("#tournamentLogoPreview");
const manualTeamForm=$("#manualTeamForm"),manualTeamTournament=$("#manualTeamTournament"),manualTeamName=$("#manualTeamName"),manualTeamLogoFile=$("#manualTeamLogoFile"),manualTeamLogoPreview=$("#manualTeamLogoPreview"),manualTeamSubmitBtn=$("#manualTeamSubmitBtn"),manualTeamMessage=$("#manualTeamMessage"),manualTeamsList=$("#manualTeamsList");
const applications=$("#applications"),stats=$("#stats"),emptyState=$("#emptyState"),pendingBadge=$("#pendingBadge");
const usersList=$("#usersList"),usersCount=$("#usersCount");
const bracketTournament=$("#bracketTournament"),bracketImageFile=$("#bracketImageFile"),saveBracketImageBtn=$("#saveBracketImageBtn"),removeBracketImageBtn=$("#removeBracketImageBtn"),bracketImagePreview=$("#bracketImagePreview"),bracketImageFile2=$("#bracketImageFile2"),saveBracketImageBtn2=$("#saveBracketImageBtn2"),removeBracketImageBtn2=$("#removeBracketImageBtn2"),bracketImagePreview2=$("#bracketImagePreview2"),bracketMessage=$("#bracketMessage");

let tournaments=[],registrations=[],manualTeams=[],editingTournamentId=null,tabsReady=false,siteSettings=null,siteLogoRemoved=false;

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

const applicationStatusLabel=s=>({pending:"Очікує",approved:"Прийнята",rejected:"Відхилена"}[s]||String(s).toUpperCase());
const applicationStatusIcon=s=>s==="approved"?"badge-check":s==="rejected"?"circle-x":"clock-3";

async function loadUserApplications(user){
  if(!userApplications)return;
  userApplications.innerHTML='<div class="empty-state">Завантаження заявок...</div>';
  const {data,error}=await supabase
    .from("team_registrations")
    .select("id,created_at,tournament_id,team_name,team_tag,team_logo_url,status,players,substitutes,tournaments(name,starts_at,status)")
    .eq("user_id",user.id)
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    userApplications.innerHTML='<div class="empty-state error">Не вдалося завантажити ваші заявки.</div>';
    return;
  }

  const items=data||[];
  const pending=items.filter(x=>x.status==="pending").length;
  const approved=items.filter(x=>x.status==="approved").length;
  const rejected=items.filter(x=>x.status==="rejected").length;
  if(userApplicationsCount)userApplicationsCount.textContent=String(items.length);
  if(userApplicationStats)userApplicationStats.innerHTML=`
    <div><b>${items.length}</b><span>всього</span></div>
    <div><b>${pending}</b><span>очікують</span></div>
    <div><b>${approved}</b><span>прийняті</span></div>
    <div><b>${rejected}</b><span>відхилені</span></div>`;

  if(!items.length){
    userApplications.innerHTML=`<div class="user-empty-applications">
      <i data-lucide="clipboard-plus"></i>
      <div><b>Заявок ще немає</b><span>Подайте команду на відкритий турнір — вона з’явиться тут.</span></div>
      <a class="primary-btn" href="apply.html"><i data-lucide="send-horizontal"></i><span>Подати заявку</span></a>
    </div>`;
    window.refreshIcons?.();
    return;
  }

  userApplications.innerHTML=items.map(item=>{
    const logo=safeUrl(item.team_logo_url);
    const players=Array.isArray(item.players)?item.players:[];
    const substitutes=Array.isArray(item.substitutes)?item.substitutes:[];
    const tournament=item.tournaments||{};
    const start=tournament.starts_at?new Date(tournament.starts_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Дата не вказана";
    return `<article class="user-application-card">
      <div class="user-application-main">
        <div class="user-application-logo ${logo?"has-logo":""}">${logo?`<img src="${esc(logo)}" alt="${esc(item.team_name)} logo">`:esc((item.team_tag||item.team_name||"A").slice(0,1).toUpperCase())}</div>
        <div class="user-application-copy">
          <small>${esc(tournament.name||"Турнір")}</small>
          <h3>${esc(item.team_name)} <span>[${esc(item.team_tag)}]</span></h3>
          <div class="user-application-meta">
            <span><i data-lucide="users"></i>${players.length} основних · ${substitutes.length} замін</span>
            <span><i data-lucide="calendar-days"></i>${esc(start)}</span>
          </div>
        </div>
        <span class="cabinet-status cabinet-status-${esc(item.status)}"><i data-lucide="${applicationStatusIcon(item.status)}"></i>${applicationStatusLabel(item.status)}</span>
      </div>
      <div class="user-application-footer">
        <span>Заявка #${item.id} · ${new Date(item.created_at).toLocaleString("uk-UA")}</span>
        <a class="secondary-btn" href="tournament.html?id=${item.tournament_id}"><i data-lucide="external-link"></i><span>Відкрити турнір</span></a>
      </div>
    </article>`;
  }).join("");
  window.refreshIcons?.();
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
    await loadUserApplications(user);
    return;
  }

  userView?.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  adminEmail.textContent=user.email||"";
  setupTabs();
  await loadSiteSettings();
  await loadTournaments();
  await loadApplications();
  await loadManualTeams();
  renderTournaments();
  await Promise.all([loadUsers(),loadBracketImage()]);
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
    const approved=registrations.filter(r=>r.tournament_id===t.id&&r.status==="approved").length+manualTeams.filter(m=>m.tournament_id===t.id).length;
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
    const t=tournaments.find(x=>x.id===Number(btn.dataset.deleteTournament));if(!t||!confirm(`Видалити турнір "${t.name}" разом із його заявками та сіткою?`))return;
    await supabase.from("tournaments").delete().eq("id",t.id);await Promise.all([loadTournaments(),loadApplications()]);await loadBracketImage();
  }));
}

function populateTournamentSelects(){
  const options=tournaments.length
    ? '<option value="">Обери турнір</option>'+tournaments.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")
    : '<option value="">Спочатку створи турнір</option>';

  if(bracketTournament)bracketTournament.innerHTML=options;
  if(manualTeamTournament)manualTeamTournament.innerHTML=options;
}

bracketTournament?.addEventListener("change",loadBracketImage);

manualTeamLogoFile?.addEventListener("change",()=>{
  const file=manualTeamLogoFile.files?.[0];
  if(!file){
    previewImage(manualTeamLogoPreview,null,manualTeamName?.value||"A");
    return;
  }
  previewImage(manualTeamLogoPreview,URL.createObjectURL(file),manualTeamName?.value||"A");
});

manualTeamName?.addEventListener("input",()=>{
  if(!manualTeamLogoFile?.files?.[0])previewImage(manualTeamLogoPreview,null,manualTeamName.value||"A");
});

async function loadManualTeams(){
  if(!manualTeamsList)return;

  const {data,error}=await supabase
    .from("manual_tournament_teams")
    .select("id,created_at,tournament_id,team_name,team_logo_url,tournaments(name)")
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    manualTeamsList.innerHTML='<div class="empty-state error">Не вдалося завантажити ручні команди.</div>';
    return;
  }

  manualTeams=data||[];
  renderManualTeams();
  renderTournaments();
}

function renderManualTeams(){
  if(!manualTeamsList)return;

  if(!manualTeams.length){
    manualTeamsList.innerHTML='<div class="empty-state">Ручних команд поки немає.</div>';
    return;
  }

  manualTeamsList.innerHTML=manualTeams.map(team=>{
    const logo=safeUrl(team.team_logo_url);
    return `<article class="manual-team-row">
      <div class="manual-team-row-main">
        <div class="manual-team-row-logo ${logo?"has-logo":""}">${logo?`<img src="${esc(logo)}" alt="${esc(team.team_name)} logo">`:esc(team.team_name.slice(0,1).toUpperCase())}</div>
        <div><small>${esc(team.tournaments?.name||"Турнір")}</small><b>${esc(team.team_name)}</b></div>
      </div>
      <button class="btn reject" type="button" data-delete-manual-team="${team.id}"><i data-lucide="trash-2"></i><span>Видалити</span></button>
    </article>`;
  }).join("");

  window.refreshIcons?.();

  manualTeamsList.querySelectorAll("[data-delete-manual-team]").forEach(btn=>btn.addEventListener("click",async()=>{
    const id=Number(btn.dataset.deleteManualTeam);
    const team=manualTeams.find(x=>x.id===id);
    if(!team||!confirm(`Видалити команду "${team.team_name}" з турніру?`))return;

    btn.disabled=true;
    const {error}=await supabase.from("manual_tournament_teams").delete().eq("id",id);

    if(error){
      console.error(error);
      alert("Не вдалося видалити команду.");
      btn.disabled=false;
      return;
    }

    await loadManualTeams();
    await loadTournaments();
  }));
}

manualTeamForm?.addEventListener("submit",async e=>{
  e.preventDefault();

  const tournamentId=Number(manualTeamTournament?.value||0);
  const teamName=String(manualTeamName?.value||"").trim();
  const logoFile=manualTeamLogoFile?.files?.[0]||null;

  manualTeamMessage.textContent="";
  manualTeamMessage.className="";

  if(!tournamentId){
    manualTeamMessage.textContent="Обери турнір.";
    manualTeamMessage.className="error";
    return;
  }

  if(teamName.length<2){
    manualTeamMessage.textContent="Вкажи назву команди.";
    manualTeamMessage.className="error";
    manualTeamName?.focus();
    return;
  }

  if(!logoFile){
    manualTeamMessage.textContent="Додай логотип команди.";
    manualTeamMessage.className="error";
    manualTeamLogoFile?.focus();
    return;
  }

  manualTeamSubmitBtn.disabled=true;
  setButtonContent(manualTeamSubmitBtn,"loader-circle","Завантажуємо...");

  try{
    const logoUrl=await uploadAsset(logoFile,`manual-teams/${tournamentId}`);

    const {error}=await supabase
      .from("manual_tournament_teams")
      .insert({
        tournament_id:tournamentId,
        team_name:teamName,
        team_logo_url:logoUrl
      });

    if(error)throw error;

    manualTeamForm.reset();
    previewImage(manualTeamLogoPreview,null,"A");
    manualTeamMessage.textContent="Команду додано на турнір.";
    manualTeamMessage.className="success";

    await loadManualTeams();
    await loadTournaments();
  }catch(error){
    console.error(error);
    const msg=String(error?.message||"");

    if(error?.code==="23505"||msg.includes("team_name_already_registered")){
      manualTeamMessage.textContent="Команда з такою назвою вже є на цьому турнірі.";
    }else if(msg.includes("tournament_team_limit_reached")){
      manualTeamMessage.textContent="Ліміт команд на цьому турнірі вже заповнений.";
    }else if(error?.code==="42501"){
      manualTeamMessage.textContent="Немає прав для додавання команди.";
    }else{
      manualTeamMessage.textContent="Не вдалося додати команду.";
    }

    manualTeamMessage.className="error";
  }finally{
    manualTeamSubmitBtn.disabled=false;
    setButtonContent(manualTeamSubmitBtn,"plus","Додати команду");
  }
});

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
  renderTournaments();
}

function renderApplication(item){
  const logo=safeUrl(item.team_logo_url);
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
    <div class="application-head">
      <div class="application-team">
        <div class="application-team-logo ${logo?"has-logo":""}">${logo?`<img src="${esc(logo)}" alt="${esc(item.team_name)} logo">`:esc((item.team_tag||item.team_name||"A").slice(0,1).toUpperCase())}</div>
        <div><small>${esc(item.tournaments?.name||"Турнір")}</small><h3>${esc(item.team_name)} <span class="muted">[${esc(item.team_tag)}]</span></h3><div class="meta">#${item.id} · ${new Date(item.created_at).toLocaleString("uk-UA")}</div></div>
      </div>
      <span class="pill">${esc(item.status)}</span>
    </div>
    <div class="application-grid"><div><span>Капітан:</span> ${esc(item.captain_nick)}</div><div><span>Email:</span> ${esc(item.captain_email)}</div><div><span>Контакт:</span> ${esc(item.contact)}</div><div><span>Логотип:</span> ${logo?'<a href="'+esc(logo)+'" target="_blank" rel="noopener noreferrer">відкрити</a>':"—"}</div></div>
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
  e.currentTarget.disabled=true;

  try{
    let error=null;

    if(action==="delete"){
      if(!confirm("Видалити заявку?")){
        e.currentTarget.disabled=false;
        return;
      }
      ({error}=await supabase.from("team_registrations").delete().eq("id",id));
    }else{
      ({error}=await supabase.from("team_registrations").update({status:action}).eq("id",id));
    }

    if(error){
      console.error(error);
      if(String(error.message||"").includes("tournament_team_limit_reached")){
        alert("Ліміт команд на цьому турнірі вже заповнений. Реєстрація закрита.");
      }else{
        alert("Не вдалося змінити статус заявки.");
      }
      return;
    }

    await loadTournaments();
    await loadApplications();
  }finally{
    e.currentTarget.disabled=false;
  }
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

function renderBracketPreview(container,url,slot=1){
  if(!container)return;

  const safe=safeUrl(url);

  if(!safe){
    container.innerHTML=`
      <div class="empty-bracket-preview">
        <i data-lucide="image"></i>
        <span>Сітка ${slot} ще не додана</span>
      </div>`;
    window.refreshIcons?.();
    return;
  }

  container.innerHTML=`
    <a href="${esc(safe)}" target="_blank" rel="noopener noreferrer" class="bracket-image-link">
      <img src="${esc(safe)}" alt="Сітка турніру ${slot}">
      <span><i data-lucide="external-link"></i> Відкрити повністю</span>
    </a>`;

  window.refreshIcons?.();
}

function getBracketSlot(slot){
  if(slot===2){
    return {
      file:bracketImageFile2,
      save:saveBracketImageBtn2,
      remove:removeBracketImageBtn2,
      preview:bracketImagePreview2,
      column:"bracket_image_url_2"
    };
  }

  return {
    file:bracketImageFile,
    save:saveBracketImageBtn,
    remove:removeBracketImageBtn,
    preview:bracketImagePreview,
    column:"bracket_image_url"
  };
}

async function loadBracketImage(){
  if(!bracketTournament||!bracketImagePreview||!bracketImagePreview2)return;

  const tournamentId=Number(bracketTournament.value||0);
  bracketMessage.textContent="";
  bracketMessage.className="";

  if(bracketImageFile)bracketImageFile.value="";
  if(bracketImageFile2)bracketImageFile2.value="";

  if(!tournamentId){
    renderBracketPreview(bracketImagePreview,null,1);
    renderBracketPreview(bracketImagePreview2,null,2);
    return;
  }

  const tournament=tournaments.find(t=>t.id===tournamentId);

  if(!tournament){
    renderBracketPreview(bracketImagePreview,null,1);
    renderBracketPreview(bracketImagePreview2,null,2);
    return;
  }

  renderBracketPreview(bracketImagePreview,tournament.bracket_image_url,1);
  renderBracketPreview(bracketImagePreview2,tournament.bracket_image_url_2,2);
}

function setupBracketFilePreview(slot){
  const config=getBracketSlot(slot);
  config.file?.addEventListener("change",()=>{
    const file=config.file.files?.[0];
    if(!file)return;
    renderBracketPreview(config.preview,URL.createObjectURL(file),slot);
  });
}

async function saveBracketSlot(slot){
  const config=getBracketSlot(slot);
  const tournamentId=Number(bracketTournament?.value||0);
  const file=config.file?.files?.[0];

  bracketMessage.textContent="";
  bracketMessage.className="";

  if(!tournamentId){
    bracketMessage.textContent="Спочатку обери турнір.";
    bracketMessage.className="error";
    return;
  }

  if(!file){
    bracketMessage.textContent=`Обери фото для сітки ${slot}.`;
    bracketMessage.className="error";
    return;
  }

  config.save.disabled=true;
  bracketMessage.textContent=`Завантажуємо сітку ${slot}...`;

  try{
    const imageUrl=await uploadAsset(file,`brackets/${tournamentId}/slot-${slot}`);

    const {error}=await supabase
      .from("tournaments")
      .update({[config.column]:imageUrl})
      .eq("id",tournamentId);

    if(error)throw error;

    const tournament=tournaments.find(t=>t.id===tournamentId);
    if(tournament)tournament[config.column]=imageUrl;

    renderBracketPreview(config.preview,imageUrl,slot);
    config.file.value="";
    bracketMessage.textContent=`Сітку ${slot} збережено.`;
    bracketMessage.className="success";
  }catch(error){
    console.error(error);
    bracketMessage.textContent=error?.message||`Не вдалося завантажити сітку ${slot}.`;
    bracketMessage.className="error";
  }finally{
    config.save.disabled=false;
  }
}

async function removeBracketSlot(slot){
  const config=getBracketSlot(slot);
  const tournamentId=Number(bracketTournament?.value||0);

  bracketMessage.textContent="";
  bracketMessage.className="";

  if(!tournamentId){
    bracketMessage.textContent="Спочатку обери турнір.";
    bracketMessage.className="error";
    return;
  }

  if(!confirm(`Прибрати сітку ${slot} з цього турніру?`))return;

  config.remove.disabled=true;

  try{
    const {error}=await supabase
      .from("tournaments")
      .update({[config.column]:null})
      .eq("id",tournamentId);

    if(error)throw error;

    const tournament=tournaments.find(t=>t.id===tournamentId);
    if(tournament)tournament[config.column]=null;

    if(config.file)config.file.value="";
    renderBracketPreview(config.preview,null,slot);
    bracketMessage.textContent=`Сітку ${slot} прибрано.`;
    bracketMessage.className="success";
  }catch(error){
    console.error(error);
    bracketMessage.textContent=`Не вдалося прибрати сітку ${slot}.`;
    bracketMessage.className="error";
  }finally{
    config.remove.disabled=false;
  }
}

setupBracketFilePreview(1);
setupBracketFilePreview(2);

saveBracketImageBtn?.addEventListener("click",()=>saveBracketSlot(1));
saveBracketImageBtn2?.addEventListener("click",()=>saveBracketSlot(2));
removeBracketImageBtn?.addEventListener("click",()=>removeBracketSlot(1));
removeBracketImageBtn2?.addEventListener("click",()=>removeBracketSlot(2));

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
