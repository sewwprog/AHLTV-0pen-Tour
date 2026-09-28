import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabase=createClient(
  "https://hfxzdifqcjbslmxffvlf.supabase.co",
  "sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi"
);

const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeUrl=v=>{try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:null}catch{return null}};
const id=Number(new URLSearchParams(location.search).get("id"));

const hero=document.querySelector("#tournamentHero");
const teamsRoot=document.querySelector("#detailTeams");
const teamsCount=document.querySelector("#detailTeamsCount");
const bracketRoot=document.querySelector("#bracketRoot");
const rulesRoot=document.querySelector("#rulesContent");

if(!Number.isFinite(id)||id<=0){
  hero.innerHTML='<div class="empty-state error">Турнір не знайдено.</div>';
  throw new Error("invalid tournament id");
}

const [{data:tournament,error:tErr},{data:teams,error:teamErr},{data:matches,error:mErr}]=await Promise.all([
  supabase.from("tournaments").select("*").eq("id",id).eq("is_visible",true).maybeSingle(),
  supabase.rpc("get_public_teams"),
  supabase.from("tournament_matches").select("*").eq("tournament_id",id).eq("is_visible",true).order("bracket_round",{ascending:true,nullsFirst:false}).order("bracket_position",{ascending:true,nullsFirst:false})
]);

if(tErr||!tournament){
  hero.innerHTML='<div class="empty-state error">Турнір не знайдено або він прихований.</div>';
  throw tErr||new Error("not found");
}

const logo=safeUrl(tournament.logo_url);
hero.innerHTML=`
  <div class="detail-logo ${logo?"has-logo":""}">
    ${logo?`<img src="${esc(logo)}" alt="${esc(tournament.name)} logo">`:esc((tournament.short_name||tournament.name).slice(0,1).toUpperCase())}
  </div>
  <div class="detail-hero-copy">
    <small>${esc(tournament.game)} · ${esc(tournament.format)}</small>
    <h1>${esc(tournament.name)}</h1>
    <p>${esc(tournament.description||"")}</p>
    <div class="tournament-meta">
      <span>${esc(tournament.game)}</span>
      <span>${esc(tournament.format)}</span>
      <span>до ${tournament.max_teams} команд</span>
      <span>${tournament.status.toUpperCase()}</span>
    </div>
  </div>
  ${tournament.registration_open?'<a class="primary-btn detail-apply" href="apply.html?tournament='+tournament.id+'">Подати заявку</a>':""}
`;

const tournamentTeams=(teams||[]).filter(t=>t.tournament_id===id);
teamsCount.textContent=`${tournamentTeams.length} / ${tournament.max_teams}`;

teamsRoot.innerHTML=tournamentTeams.length
  ? tournamentTeams.map(t=>`<div class="detail-team-row"><span>${esc(t.team_tag)}</span><b>${esc(t.team_name)}</b></div>`).join("")
  : '<div class="empty-state">Підтверджених команд ще немає.</div>';

const bracketMatches=(matches||[]).filter(m=>m.bracket_round&&m.bracket_position);

if(!bracketMatches.length){
  bracketRoot.innerHTML='<div class="empty-state">Сітка ще не створена.</div>';
}else{
  const rounds=[...new Set(bracketMatches.map(m=>m.bracket_round))].sort((a,b)=>a-b);
  bracketRoot.innerHTML=`<div class="bracket-board">${rounds.map(round=>{
    const rm=bracketMatches.filter(m=>m.bracket_round===round).sort((a,b)=>a.bracket_position-b.bracket_position);
    const title=rm[0]?.stage||("Round "+round);
    return `<section class="bracket-round">
      <div class="bracket-round-title">${esc(title)}</div>
      <div class="bracket-round-matches">
        ${rm.map(m=>`<article class="bracket-match ${m.status==="live"?"is-live":""}">
          <div class="bracket-team"><span>${esc(m.team_one||"TBD")}</span><b>${m.team_one_score??"–"}</b></div>
          <div class="bracket-team"><span>${esc(m.team_two||"TBD")}</span><b>${m.team_two_score??"–"}</b></div>
          <small>${m.status==="live"?"LIVE":m.status.toUpperCase()} · BO${m.best_of}</small>
        </article>`).join("")}
      </div>
    </section>`;
  }).join("")}</div>`;
}

const rules=(tournament.rules_text||"").trim();
rulesRoot.innerHTML=rules
  ? rules.split(/\n{2,}/).map(block=>`<p>${esc(block).replace(/\n/g,"<br>")}</p>`).join("")
  : '<div class="empty-state">Правила для цього турніру ще не додані.</div>';
