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

const [{data:tournament,error:tErr},{data:teams,error:teamErr}]=await Promise.all([
  supabase.from("tournaments").select("*").eq("id",id).eq("is_visible",true).maybeSingle(),
  supabase.rpc("get_public_teams")
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
      <span><i data-lucide="gamepad-2"></i>${esc(tournament.game)}</span>
      <span><i data-lucide="swords"></i>${esc(tournament.format)}</span>
      <span><i data-lucide="users"></i>до ${tournament.max_teams} команд</span>
      <span><i data-lucide="circle-dot"></i>${tournament.status.toUpperCase()}</span>
    </div>
  </div>
  ${tournament.registration_open?'<a class="primary-btn detail-apply" href="apply.html?tournament='+tournament.id+'"><i data-lucide="send-horizontal"></i><span>Подати заявку</span></a>':""}
`;

const tournamentTeams=(teams||[]).filter(t=>t.tournament_id===id);
teamsCount.textContent=`${tournamentTeams.length} / ${tournament.max_teams}`;

teamsRoot.innerHTML=tournamentTeams.length
  ? tournamentTeams.map(t=>`<div class="detail-team-row"><span>${esc(t.team_tag)}</span><b>${esc(t.team_name)}</b></div>`).join("")
  : '<div class="empty-state">Підтверджених команд ще немає.</div>';

const bracketImages=[
  safeUrl(tournament.bracket_image_url),
  safeUrl(tournament.bracket_image_url_2)
].filter(Boolean);

bracketRoot.innerHTML=bracketImages.length
  ? `<div class="public-bracket-gallery ${bracketImages.length>1?"has-two":""}">
      ${bracketImages.map((image,index)=>`
        <section class="public-bracket-image">
          <div class="public-bracket-image-head">
            <span>СІТКА ${index+1}</span>
            <b>IMAGE 0${index+1}</b>
          </div>
          <a href="${esc(image)}" target="_blank" rel="noopener noreferrer">
            <img src="${esc(image)}" alt="Сітка ${index+1} турніру ${esc(tournament.name)}">
          </a>
          <a class="secondary-btn bracket-open-btn" href="${esc(image)}" target="_blank" rel="noopener noreferrer">
            <i data-lucide="external-link"></i><span>Відкрити повністю</span>
          </a>
        </section>`).join("")}
    </div>`
  : '<div class="empty-state">Фото сітки ще не додано.</div>';

const rules=(tournament.rules_text||"").trim();
rulesRoot.innerHTML=rules
  ? rules.split(/\n{2,}/).map(block=>`<p>${esc(block).replace(/\n/g,"<br>")}</p>`).join("")
  : '<div class="empty-state">Правила для цього турніру ще не додані.</div>';

window.refreshIcons?.();
