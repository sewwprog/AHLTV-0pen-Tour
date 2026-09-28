import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
const supabase=createClient("https://hfxzdifqcjbslmxffvlf.supabase.co","sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi");
const select=document.querySelector("#tournamentSelect"),hint=document.querySelector("#tournamentHint"),statusEl=document.querySelector("#selectedTournamentStatus"),form=document.querySelector("#teamForm"),message=document.querySelector("#formMessage"),submit=document.querySelector("#submitBtn");
let tournaments=[];
const statusLabel=s=>({registration:"REGISTRATION",live:"LIVE",upcoming:"UPCOMING",finished:"FINISHED"}[s]||s.toUpperCase());
const {data,error}=await supabase.from("tournaments").select("*").eq("is_visible",true).eq("registration_open",true).in("status",["registration","live"]).order("created_at",{ascending:false});
if(error){select.innerHTML='<option value="">Помилка завантаження</option>';submit.disabled=true}else{
  tournaments=data||[];select.innerHTML=tournaments.length?'<option value="">Обери турнір</option>'+tournaments.map(t=>`<option value="${t.id}">${t.name} — ${statusLabel(t.status)}</option>`).join(""):'<option value="">Немає відкритих турнірів</option>';
  if(!tournaments.length)submit.disabled=true;
  const fromUrl=new URLSearchParams(location.search).get("tournament");if(fromUrl&&tournaments.some(t=>String(t.id)===fromUrl))select.value=fromUrl;updateInfo();
}
function updateInfo(){const t=tournaments.find(x=>String(x.id)===select.value);statusEl.textContent=t?statusLabel(t.status):"";hint.innerHTML=t?`<b>${t.name}</b><span>${t.game} · ${t.format} · до ${t.max_teams} команд</span>`:""}
select.addEventListener("change",updateInfo);
form.addEventListener("submit",async e=>{
  e.preventDefault();message.className="";if(!select.value){message.textContent="Спочатку обери турнір.";message.className="error";return}
  const d=Object.fromEntries(new FormData(form).entries());
  const payload={tournament_id:Number(select.value),team_name:d.team_name.trim(),team_tag:d.team_tag.trim().toUpperCase(),captain_nick:d.captain_nick.trim(),captain_email:d.captain_email.trim().toLowerCase(),contact:d.contact.trim(),captain_profile:d.captain_profile.trim()||null,players:[d.player_1,d.player_2,d.player_3,d.player_4,d.player_5].map(v=>v.trim()),substitute:d.substitute.trim()||null,note:d.note.trim()||null};
  submit.disabled=true;submit.textContent="Відправляємо...";const {error}=await supabase.from("team_registrations").insert(payload);submit.disabled=false;submit.textContent="Відправити заявку";
  if(error){message.textContent=error.code==="23505"?"Ця команда або тег уже зареєстровані на цей турнір.":"Не вдалося відправити заявку.";message.className="error";return}
  form.reset();select.value="";updateInfo();message.textContent="Заявку відправлено.";message.className="success";
});