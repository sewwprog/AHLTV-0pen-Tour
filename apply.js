import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabase=createClient(
  "https://hfxzdifqcjbslmxffvlf.supabase.co",
  "sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi"
);
const ASSET_BUCKET="ahltv-assets";

const authGate=document.querySelector("#authGate");
const applicationContent=document.querySelector("#applicationContent");
const applyUserEmail=document.querySelector("#applyUserEmail");
const select=document.querySelector("#tournamentSelect");
const hint=document.querySelector("#tournamentHint");
const statusEl=document.querySelector("#selectedTournamentStatus");
const form=document.querySelector("#teamForm");
const message=document.querySelector("#formMessage");
const submit=document.querySelector("#submitBtn");
const substitutesList=document.querySelector("#substitutesList");
const addSubstituteBtn=document.querySelector("#addSubstituteBtn");
const teamLogoFile=document.querySelector("#teamLogoFile");
const teamLogoPreview=document.querySelector("#teamLogoPreview");

let tournaments=[];
let currentUser=null;
let teamLogoObjectUrl=null;

const allowedTeamLogoTypes=new Set(["image/png","image/jpeg","image/webp"]);

function resetTeamLogoPreview(){
  if(teamLogoObjectUrl){
    URL.revokeObjectURL(teamLogoObjectUrl);
    teamLogoObjectUrl=null;
  }

  if(teamLogoPreview){
    teamLogoPreview.classList.remove("has-image");
    teamLogoPreview.innerHTML='<i data-lucide="image"></i>';
    window.refreshIcons?.();
  }
}

function previewTeamLogo(file){
  if(!teamLogoPreview||!file)return;
  if(teamLogoObjectUrl)URL.revokeObjectURL(teamLogoObjectUrl);
  teamLogoObjectUrl=URL.createObjectURL(file);
  teamLogoPreview.classList.add("has-image");
  teamLogoPreview.innerHTML="";
  const img=document.createElement("img");
  img.src=teamLogoObjectUrl;
  img.alt="Логотип команди";
  teamLogoPreview.appendChild(img);
}

async function uploadTeamLogo(file){
  if(!file)return null;
  if(!currentUser)throw new Error("Потрібно увійти в акаунт.");
  if(file.size>5*1024*1024)throw new Error("Логотип завеликий. Максимум 5 МБ.");
  if(!allowedTeamLogoTypes.has(file.type))throw new Error("Логотип має бути PNG, JPG або WEBP.");

  const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const path=`team-logos/${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const {error}=await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});

  if(error)throw error;

  const {data}=supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

teamLogoFile?.addEventListener("change",()=>{
  const file=teamLogoFile.files?.[0]||null;

  if(!file){
    resetTeamLogoPreview();
    return;
  }

  if(file.size>5*1024*1024||!allowedTeamLogoTypes.has(file.type)){
    teamLogoFile.value="";
    resetTeamLogoPreview();
    message.textContent=file.size>5*1024*1024
      ?"Логотип завеликий. Максимум 5 МБ."
      :"Логотип має бути PNG, JPG або WEBP.";
    message.className="error";
    return;
  }

  message.textContent="";
  message.className="";
  previewTeamLogo(file);
});

const statusLabel=s=>({
  registration:"REGISTRATION",
  live:"LIVE",
  upcoming:"UPCOMING",
  finished:"FINISHED"
}[s]||String(s).toUpperCase());

function isSteamUrl(value){
  try{
    const url=new URL(String(value||"").trim());
    const host=url.hostname.toLowerCase().replace(/^www\./,"");
    return url.protocol==="https:"&&(host==="steamcommunity.com"||host==="s.team");
  }catch{
    return false;
  }
}

function showAuthGate(){
  authGate.classList.remove("hidden");
  applicationContent.classList.add("hidden");
}

function showApplication(){
  authGate.classList.add("hidden");
  applicationContent.classList.remove("hidden");
  if(applyUserEmail)applyUserEmail.textContent=currentUser?.email||"";
  const emailInput=form.elements.captain_email;
  if(emailInput&&!emailInput.value&&currentUser?.email)emailInput.value=currentUser.email;
}

async function requireSession(){
  const {data:{session}}=await supabase.auth.getSession();
  currentUser=session?.user||null;

  if(!currentUser){
    showAuthGate();
    return false;
  }

  showApplication();
  return true;
}

async function loadTournaments(){
  const {data,error}=await supabase
    .from("tournaments")
    .select("*")
    .eq("is_visible",true)
    .eq("registration_open",true)
    .in("status",["registration","live"])
    .order("created_at",{ascending:false});

  if(error){
    select.innerHTML='<option value="">Помилка завантаження</option>';
    submit.disabled=true;
    return;
  }

  tournaments=data||[];

  select.innerHTML=tournaments.length
    ? '<option value="">Обери турнір</option>'+tournaments.map(t=>`<option value="${t.id}">${t.name} — ${statusLabel(t.status)}</option>`).join("")
    : '<option value="">Немає відкритих турнірів</option>';

  if(!tournaments.length)submit.disabled=true;

  const fromUrl=new URLSearchParams(location.search).get("tournament");
  if(fromUrl&&tournaments.some(t=>String(t.id)===fromUrl))select.value=fromUrl;

  updateInfo();
}

function updateInfo(){
  const t=tournaments.find(x=>String(x.id)===select.value);
  statusEl.textContent=t?statusLabel(t.status):"";
  hint.innerHTML=t
    ? `<b>${t.name}</b><span>${t.game} · ${t.format} · до ${t.max_teams} команд</span>`
    : "";
}

select.addEventListener("change",updateInfo);

function substituteCard(index,removable=true){
  return `
    <div class="roster-card substitute-card" data-substitute-index="${index}">
      <div class="roster-card-title">
        <span>Заміна ${index}</span>
        <div class="roster-card-title-actions">
          <b>SUB</b>
          ${removable?'<button class="icon-btn remove-substitute" type="button" aria-label="Прибрати заміну"><i data-lucide="x"></i></button>':""}
        </div>
      </div>
      <div class="roster-fields">
        <label>Нік<input name="substitute_${index}" required maxlength="32" placeholder="nickname"></label>
        <label>Steam-посилання<input name="substitute_${index}_steam" type="url" required placeholder="https://steamcommunity.com/id/..." title="Вкажи посилання Steam Community або s.team"></label>
      </div>
    </div>
  `;
}

function normalizeSubstitutes(){
  const cards=[...substitutesList.querySelectorAll(".substitute-card")];

  cards.forEach((card,i)=>{
    const index=i+1;
    card.dataset.substituteIndex=String(index);
    card.querySelector(".roster-card-title>span").textContent=`Заміна ${index}`;
    const nick=card.querySelector('input[name^="substitute_"]:not([name*="_steam"])');
    const steam=card.querySelector('input[name$="_steam"]');
    if(nick)nick.name=`substitute_${index}`;
    if(steam)steam.name=`substitute_${index}_steam`;

    const actions=card.querySelector(".roster-card-title-actions");
    let remove=card.querySelector(".remove-substitute");

    if(cards.length>1&&!remove){
      actions.insertAdjacentHTML("beforeend",'<button class="icon-btn remove-substitute" type="button" aria-label="Прибрати заміну"><i data-lucide="x"></i></button>');
      remove=card.querySelector(".remove-substitute");
    }

    if(cards.length===1&&remove)remove.remove();
  });

  addSubstituteBtn.disabled=cards.length>=3;
  window.refreshIcons?.();
}

addSubstituteBtn?.addEventListener("click",()=>{
  const count=substitutesList.querySelectorAll(".substitute-card").length;
  if(count>=3)return;
  substitutesList.insertAdjacentHTML("beforeend",substituteCard(count+1,true));
  normalizeSubstitutes();
});

substitutesList?.addEventListener("click",event=>{
  const button=event.target.closest(".remove-substitute");
  if(!button)return;

  const cards=substitutesList.querySelectorAll(".substitute-card");
  if(cards.length<=1)return;

  button.closest(".substitute-card")?.remove();
  normalizeSubstitutes();
});

function resetSubstitutes(){
  substitutesList.innerHTML=substituteCard(1,false);
  normalizeSubstitutes();
}

function validateRoster(data){
  const players=[];
  const playerSteamLinks=[];

  for(let i=1;i<=5;i++){
    const nick=String(data[`player_${i}`]||"").trim();
    const steam=String(data[`player_${i}_steam`]||"").trim();

    if(!nick){
      return {error:`Вкажи нік гравця ${i}.`,focus:form.elements[`player_${i}`]};
    }

    if(!isSteamUrl(steam)){
      return {error:`Вкажи правильне Steam-посилання для гравця ${i}.`,focus:form.elements[`player_${i}_steam`]};
    }

    players.push(nick);
    playerSteamLinks.push(steam);
  }

  const substituteCards=[...substitutesList.querySelectorAll(".substitute-card")];

  if(substituteCards.length<1||substituteCards.length>3){
    return {error:"Потрібно вказати від 1 до 3 замін."};
  }

  const substitutes=[];
  const substituteSteamLinks=[];

  for(let i=1;i<=substituteCards.length;i++){
    const nick=String(data[`substitute_${i}`]||"").trim();
    const steam=String(data[`substitute_${i}_steam`]||"").trim();

    if(!nick){
      return {error:`Вкажи нік заміни ${i}.`,focus:form.elements[`substitute_${i}`]};
    }

    if(!isSteamUrl(steam)){
      return {error:`Вкажи правильне Steam-посилання для заміни ${i}.`,focus:form.elements[`substitute_${i}_steam`]};
    }

    substitutes.push(nick);
    substituteSteamLinks.push(steam);
  }

  return {players,playerSteamLinks,substitutes,substituteSteamLinks};
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  message.className="";
  message.textContent="";

  const {data:{session}}=await supabase.auth.getSession();
  currentUser=session?.user||null;

  if(!currentUser){
    showAuthGate();
    location.href="admin.html?next=apply.html";
    return;
  }

  if(!select.value){
    message.textContent="Спочатку обери турнір.";
    message.className="error";
    return;
  }

  const d=Object.fromEntries(new FormData(form).entries());
  const contact=String(d.contact||"").trim();

  if(contact.length<2){
    message.textContent="Обов’язково вкажи Telegram або Discord.";
    message.className="error";
    form.elements.contact.focus();
    return;
  }

  const roster=validateRoster(d);

  if(roster.error){
    message.textContent=roster.error;
    message.className="error";
    roster.focus?.focus();
    return;
  }

  let teamLogoUrl=null;
  const logoFile=teamLogoFile?.files?.[0]||null;

  if(logoFile){
    submit.disabled=true;
    const uploadText=submit.querySelector("span");
    if(uploadText)uploadText.textContent="Завантажуємо лого...";

    try{
      teamLogoUrl=await uploadTeamLogo(logoFile);
    }catch(error){
      console.error(error);
      submit.disabled=false;
      if(uploadText)uploadText.textContent="Відправити заявку";
      message.textContent=error?.message||"Не вдалося завантажити логотип.";
      message.className="error";
      return;
    }
  }

  const payload={
    tournament_id:Number(select.value),
    user_id:currentUser.id,
    team_name:d.team_name.trim(),
    team_tag:d.team_tag.trim().toUpperCase(),
    captain_nick:d.captain_nick.trim(),
    captain_email:d.captain_email.trim().toLowerCase(),
    contact,
    team_logo_url:teamLogoUrl,
    players:roster.players,
    player_steam_links:roster.playerSteamLinks,
    substitutes:roster.substitutes,
    substitute_steam_links:roster.substituteSteamLinks,
    note:d.note.trim()||null
  };

  submit.disabled=true;
  const submitText=submit.querySelector("span");
  if(submitText)submitText.textContent="Відправляємо...";

  const {error}=await supabase.from("team_registrations").insert(payload);

  submit.disabled=false;
  if(submitText)submitText.textContent="Відправити заявку";

  if(error){
    console.error(error);

    if(error.code==="23505"){
      message.textContent="Ця команда або тег уже зареєстровані на цей турнір.";
    }else if(error.code==="23514"){
      message.textContent="Перевір склад: 5 гравців, 1–3 заміни та правильні Steam-посилання.";
    }else if(error.code==="42501"){
      message.textContent="Для подачі заявки потрібно увійти в акаунт.";
    }else{
      message.textContent="Не вдалося відправити заявку.";
    }

    message.className="error";
    return;
  }

  form.reset();
  resetSubstitutes();
  resetTeamLogoPreview();

  if(currentUser?.email)form.elements.captain_email.value=currentUser.email;

  select.value="";
  updateInfo();
  message.textContent="Заявку відправлено.";
  message.className="success";
});

normalizeSubstitutes();

if(await requireSession()){
  await loadTournaments();
}
