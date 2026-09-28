import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabase=createClient(
  "https://hfxzdifqcjbslmxffvlf.supabase.co",
  "sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi"
);

const authGate=document.querySelector("#authGate");
const applicationContent=document.querySelector("#applicationContent");
const applyUserEmail=document.querySelector("#applyUserEmail");
const select=document.querySelector("#tournamentSelect");
const hint=document.querySelector("#tournamentHint");
const statusEl=document.querySelector("#selectedTournamentStatus");
const form=document.querySelector("#teamForm");
const message=document.querySelector("#formMessage");
const submit=document.querySelector("#submitBtn");

let tournaments=[];
let currentUser=null;

const statusLabel=s=>({
  registration:"REGISTRATION",
  live:"LIVE",
  upcoming:"UPCOMING",
  finished:"FINISHED"
}[s]||String(s).toUpperCase());

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

  const payload={
    tournament_id:Number(select.value),
    user_id:currentUser.id,
    team_name:d.team_name.trim(),
    team_tag:d.team_tag.trim().toUpperCase(),
    captain_nick:d.captain_nick.trim(),
    captain_email:d.captain_email.trim().toLowerCase(),
    contact,
    captain_profile:d.captain_profile.trim()||null,
    players:[d.player_1,d.player_2,d.player_3,d.player_4,d.player_5].map(v=>v.trim()),
    substitute:d.substitute.trim()||null,
    note:d.note.trim()||null
  };

  submit.disabled=true;
  submit.textContent="Відправляємо...";

  const {error}=await supabase.from("team_registrations").insert(payload);

  submit.disabled=false;
  submit.textContent="Відправити заявку";

  if(error){
    console.error(error);
    if(error.code==="23505"){
      message.textContent="Ця команда або тег уже зареєстровані на цей турнір.";
    }else if(error.code==="42501"){
      message.textContent="Для подачі заявки потрібно увійти в акаунт.";
    }else{
      message.textContent="Не вдалося відправити заявку.";
    }
    message.className="error";
    return;
  }

  form.reset();
  if(currentUser?.email)form.elements.captain_email.value=currentUser.email;
  select.value="";
  updateInfo();
  message.textContent="Заявку відправлено.";
  message.className="success";
});

if(await requireSession()){
  await loadTournaments();
}
