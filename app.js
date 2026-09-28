import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
const supabase=createClient("https://hfxzdifqcjbslmxffvlf.supabase.co","sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi");
const root=document.querySelector("#tournamentsList");
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeHttpUrl=v=>{try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:null}catch{return null}};
const tournamentLogo=t=>{
  const logo=safeHttpUrl(t.logo_url);
  if(logo)return `<div class="tournament-icon has-logo"><img src="${esc(logo)}" alt="${esc(t.name)} logo"></div>`;
  return `<div class="tournament-icon">${esc((t.short_name||t.name).slice(0,1).toUpperCase())}</div>`;
};
const statusLabel=s=>({upcoming:"UPCOMING",registration:"REGISTRATION",live:"LIVE",finished:"FINISHED"}[s]||s.toUpperCase());
const dateLabel=v=>v?new Date(v).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Дата не вказана";
const [{data:tournaments,error:tErr},{data:teams},{data:matches}]=await Promise.all([
  supabase.from("tournaments").select("*").eq("is_visible",true).order("created_at",{ascending:false}),
  supabase.rpc("get_public_teams"),
  supabase.from("tournament_matches").select("*").eq("is_visible",true).order("starts_at",{ascending:true,nullsFirst:false})
]);
if(tErr){root.innerHTML='<section class="panel loading-panel error">Не вдалося завантажити турніри.</section>';throw tErr}
if(!tournaments.length){root.innerHTML='<section class="panel loading-panel">Адміністратор ще не додав жодного турніру.</section>'}
else root.innerHTML=tournaments.map(t=>{
  const tt=(teams||[]).filter(x=>x.tournament_id===t.id),mm=(matches||[]).filter(x=>x.tournament_id===t.id);
  return `<article class="panel tournament-card">
    <div class="tournament-card-head">
      ${tournamentLogo(t)}
      <div class="tournament-title"><small>${esc(t.game)} · ${esc(t.format)}</small><h2>${esc(t.name)}</h2><div class="tournament-meta"><span>${esc(t.game)}</span><span>${esc(t.format)}</span><span>${tt.length} / ${t.max_teams} команд</span><span>${dateLabel(t.starts_at)}</span></div></div>
      <span class="status-badge status-${esc(t.status)}">${statusLabel(t.status)}</span>
    </div>
    ${t.description?`<p class="tournament-description">${esc(t.description)}</p>`:""}
    <div class="tournament-sections">
      <section><div class="section-mini-head"><b>Команди</b><span>${tt.length} / ${t.max_teams}</span></div><div class="team-chips">${tt.length?tt.map(x=>`<span><b>${esc(x.team_tag)}</b> ${esc(x.team_name)}</span>`).join(""):'<em>Підтверджених команд ще немає.</em>'}</div></section>
      ${mm.length?`<section><div class="section-mini-head"><b>Матчі</b><span>${mm.length}</span></div><div class="mini-matches">${mm.map(m=>`<div><span>${m.starts_at?new Date(m.starts_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"TBA"}</span><b>${esc(m.team_one)} <i>vs</i> ${esc(m.team_two)}</b><strong class="${m.status==="live"?"live-text":""}">${m.status==="live"?"LIVE":"BO"+m.best_of}</strong></div>`).join("")}</div></section>`:""}
    </div>
    <div class="tournament-card-footer">
      <span>${t.registration_open?"Реєстрація відкрита":"Реєстрація закрита"}</span>
      <div class="tournament-footer-actions">
        <a class="secondary-btn" href="tournament.html?id=${t.id}">Відкрити турнір</a>
        ${t.registration_open&&["registration","live"].includes(t.status)?`<a class="primary-btn" href="apply.html?tournament=${t.id}">Подати заявку</a>`:""}
      </div>
    </div>
  </article>`;
}).join("");