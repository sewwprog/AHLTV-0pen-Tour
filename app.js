import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
const supabase=createClient("https://hfxzdifqcjbslmxffvlf.supabase.co","sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi");
const root=document.querySelector("#tournamentsList");
const summary=document.querySelector("#homeRegistrationSummary");
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeHttpUrl=v=>{try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:null}catch{return null}};
const tournamentLogo=t=>{
  const logo=safeHttpUrl(t.logo_url);
  if(logo)return `<div class="tournament-icon has-logo"><img src="${esc(logo)}" alt="${esc(t.name)} logo"></div>`;
  return `<div class="tournament-icon">${esc((t.short_name||t.name).slice(0,1).toUpperCase())}</div>`;
};
const statusLabel=s=>({upcoming:"UPCOMING",registration:"REGISTRATION",live:"LIVE",finished:"FINISHED"}[s]||s.toUpperCase());
const dateLabel=v=>v?new Date(v).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Дата не вказана";
const shortDateLabel=v=>v?new Date(v).toLocaleDateString("uk-UA",{day:"numeric",month:"long"}):"дату не вказано";
const [{data:tournaments,error:tErr},{data:teams},{data:matches}]=await Promise.all([
  supabase.from("tournaments").select("*").eq("is_visible",true).order("created_at",{ascending:false}),
  supabase.rpc("get_public_teams"),
  supabase.from("tournament_matches").select("*").eq("is_visible",true).order("starts_at",{ascending:true,nullsFirst:false})
]);
if(tErr){root.innerHTML='<section class="panel loading-panel error">Не вдалося завантажити турніри.</section>';throw tErr}

const featured=tournaments.find(t=>t.registration_open&&["registration","live"].includes(t.status));
if(summary&&featured){
  const registered=(teams||[]).filter(x=>x.tournament_id===featured.id).length;
  summary.classList.remove("hidden");
  summary.innerHTML=`
    <div class="home-registration-copy">
      <span class="registration-live-dot"></span>
      <b>Реєстрація відкрита</b>
      <span class="summary-separator">·</span>
      <strong>${registered}/${featured.max_teams} місць</strong>
      <span class="summary-separator">·</span>
      <span>старт ${shortDateLabel(featured.starts_at)}</span>
    </div>
    <a href="apply.html?tournament=${featured.id}"><span>${esc(featured.name)}</span><i data-lucide="arrow-right"></i></a>
  `;
}
if(!tournaments.length){root.innerHTML='<section class="panel loading-panel">Адміністратор ще не додав жодного турніру.</section>'}
else root.innerHTML=tournaments.map(t=>{
  const tt=(teams||[]).filter(x=>x.tournament_id===t.id),mm=(matches||[]).filter(x=>x.tournament_id===t.id);
  const filled=Math.min(tt.length,t.max_teams),seatsLeft=Math.max(0,t.max_teams-filled),seatPercent=t.max_teams?Math.min(100,Math.round((filled/t.max_teams)*100)):0;
  return `<article class="panel tournament-card">
    <div class="tournament-card-head">
      ${tournamentLogo(t)}
      <div class="tournament-title"><small>${esc(t.game)} · ${esc(t.format)}</small><h2>${esc(t.name)}</h2><div class="tournament-meta"><span><i data-lucide="gamepad-2"></i>${esc(t.game)}</span><span><i data-lucide="swords"></i>${esc(t.format)}</span><span><i data-lucide="users"></i>${tt.length} / ${t.max_teams} команд</span><span><i data-lucide="calendar-days"></i>${dateLabel(t.starts_at)}</span></div></div>
      <span class="status-badge status-${esc(t.status)}">${statusLabel(t.status)}</span>
    </div>
    ${t.description?`<p class="tournament-description">${esc(t.description)}</p>`:""}
    <div class="tournament-quick-status">
      <span class="${t.registration_open?"open":"closed"}"><i data-lucide="${t.registration_open?"circle-check":"circle-x"}"></i>${t.registration_open?"Реєстрація відкрита":"Реєстрація закрита"}</span>
      <i class="quick-dot">·</i><strong>${filled}/${t.max_teams} місць</strong><i class="quick-dot">·</i><span>старт ${shortDateLabel(t.starts_at)}</span>
    </div>
    <div class="seat-meter">
      <div class="seat-meter-head"><span>Заповнення турніру</span><b>${seatPercent}%</b></div>
      <div class="seat-meter-track"><span style="width:${seatPercent}%"></span></div>
      <small>${seatsLeft>0?`Залишилось ${seatsLeft} місць`:"Вільних місць немає"}</small>
    </div>
    <div class="tournament-sections">
      <section><div class="section-mini-head"><b><i data-lucide="users"></i>Команди</b><span>${tt.length} / ${t.max_teams}</span></div><div class="team-chips">${tt.length?tt.map(x=>`<span><b>${esc(x.team_tag)}</b> ${esc(x.team_name)}</span>`).join(""):'<em>Підтверджених команд ще немає.</em>'}</div></section>
      ${mm.length?`<section><div class="section-mini-head"><b><i data-lucide="swords"></i>Матчі</b><span>${mm.length}</span></div><div class="mini-matches">${mm.map(m=>`<div><span>${m.starts_at?new Date(m.starts_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"TBA"}</span><b>${esc(m.team_one)} <i>vs</i> ${esc(m.team_two)}</b><strong class="${m.status==="live"?"live-text":""}">${m.status==="live"?"LIVE":"BO"+m.best_of}</strong></div>`).join("")}</div></section>`:""}
    </div>
    <div class="tournament-card-footer">
      <span><i data-lucide="circle-dot"></i> ${t.registration_open?"Реєстрація відкрита":"Реєстрація закрита"}</span>
      <div class="tournament-footer-actions">
        <a class="secondary-btn" href="tournament.html?id=${t.id}"><i data-lucide="external-link"></i><span>Відкрити турнір</span></a>
        ${t.registration_open&&["registration","live"].includes(t.status)?`<a class="primary-btn" href="apply.html?tournament=${t.id}"><i data-lucide="send-horizontal"></i><span>Подати заявку</span></a>`:""}
      </div>
    </div>
  </article>`;
}).join("");
window.refreshIcons?.();
