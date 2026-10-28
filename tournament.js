import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {fontCss,fontLabel} from "./fonts.js";

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
const detailTeamSearch=document.querySelector("#detailTeamSearch");
const detailTeamSort=document.querySelector("#detailTeamSort");
const bracketLightbox=document.querySelector("#bracketLightbox");
const bracketLightboxImg=document.querySelector("#bracketLightboxImg");
const bracketLightboxClose=document.querySelector("#bracketLightboxClose");

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
const statusLabel=({upcoming:"НЕЗАБАРОМ",registration:"РЕЄСТРАЦІЯ",live:"LIVE",finished:"ЗАВЕРШЕНО"})[tournament.status]||String(tournament.status||"ТУРНІР").toUpperCase();
const startDate=tournament.starts_at?new Date(tournament.starts_at):null;
const startLabel=startDate&&!Number.isNaN(startDate.getTime())
  ? startDate.toLocaleString("uk-UA",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
  : "Дату не вказано";
const registrationOpen=tournament.registration_open&&["registration","live"].includes(tournament.status);
const tournamentTeams=(teams||[]).filter(t=>t.tournament_id===id);
const maxTeams=Number(tournament.max_teams)||0;
const progressPct=maxTeams>0?Math.min(100,Math.round((tournamentTeams.length/maxTeams)*100)):0;
const startTime=startDate?startDate.getTime():0;
const daysToStart=startDate&&startTime>Date.now()?Math.floor((startTime-Date.now())/86400000):0;
const showCountdown=startDate&&startTime>Date.now()&&tournament.status==="upcoming";
teamsCount.textContent=teamErr?"—":`${tournamentTeams.length} / ${maxTeams}`;
hero.innerHTML=`
  <div class="detail-logo ${logo?"has-logo":""}">
    ${logo?`<img src="${esc(logo)}" alt="${esc(tournament.name)} logo">`:esc((tournament.short_name||tournament.name).slice(0,1).toUpperCase())}
  </div>
  <div class="detail-hero-copy">
    <small>${esc(tournament.game)} · ${esc(tournament.format)}</small>
    <div class="detail-hero-title-row">
      <h1 style="${fontCss(tournament.name_font)}">${esc(tournament.name)}</h1>
      <span class="detail-status-pill status-${esc(tournament.status)}"><span aria-hidden="true"></span>${esc(statusLabel)}</span>
    </div>
    <p>${esc(tournament.description||"")}</p>
    <div class="tournament-meta">
      <span><i data-lucide="gamepad-2"></i>${esc(tournament.game)}</span>
      <span><i data-lucide="swords"></i>${esc(tournament.format)}</span>
      <span><i data-lucide="users"></i>${tournamentTeams.length} / ${maxTeams} команд</span>
      ${showCountdown?`<span><i data-lucide="clock-3"></i>до початку ${daysToStart} дн.</span>`:""}
      <span><i data-lucide="calendar-days"></i>${esc(startLabel)}</span>
      <span class="detail-font-badge"><i data-lucide="type"></i>${esc(fontLabel(tournament.name_font))}</span>
    </div>
    <div class="detail-progress">
      <div class="detail-progress-track"><div class="detail-progress-bar" style="width:${progressPct}%"></div></div>
      <span>Заповнено ${progressPct}%</span>
    </div>
  </div>
  ${registrationOpen?'<a class="primary-btn detail-apply" href="apply.html?tournament='+encodeURIComponent(tournament.id)+'"><i data-lucide="send-horizontal"></i><span>Подати заявку</span></a>':""}
`;

function renderTeams(){
  const query=(detailTeamSearch?.value||"").trim().toLocaleLowerCase("uk");
  const sort=detailTeamSort?.value||"name";
  if(teamErr){teamsRoot.innerHTML='<div class="empty-state">Не вдалося завантажити команди.</div>';return}
  if(!tournamentTeams.length){teamsRoot.innerHTML='<div class="empty-state">Підтверджених команд ще немає.</div>';return}
  const list=tournamentTeams
    .filter(t=>!query||String(t.team_name||"").toLocaleLowerCase("uk").includes(query)||String(t.team_tag||"").toLocaleLowerCase("uk").includes(query))
    .sort((a,b)=>sort==="-name"
      ?String(b.team_name||"").localeCompare(String(a.team_name||""),"uk")
      :String(a.team_name||"").localeCompare(String(b.team_name||""),"uk"));
  teamsRoot.innerHTML=list.length
    ? list.map(t=>{
        const teamLogo=safeUrl(t.team_logo_url);
        const fallback=(t.team_tag||t.team_name||"A").slice(0,2).toUpperCase();
        return `<article class="detail-team-card">
          <span class="detail-team-logo ${teamLogo?"has-logo":""}">${teamLogo?`<img src="${esc(teamLogo)}" alt="${esc(t.team_name)} logo">`:esc(fallback)}</span>
          <b>${esc(t.team_name)}${t.team_tag?`<small>[${esc(t.team_tag)}]</small>`:""}</b>
        </article>`;
      }).join("")
    : '<div class="empty-state">Не знайдено команд за запитом.</div>';
}
detailTeamSearch?.addEventListener("input",renderTeams);
detailTeamSort?.addEventListener("change",renderTeams);
renderTeams();

const bracketSlots=[
  safeUrl(tournament.bracket_image_url),
  safeUrl(tournament.bracket_image_url_2)
];

bracketRoot.innerHTML=`<div class="public-bracket-gallery has-two">
  ${bracketSlots.map((image,index)=>`
    <section class="public-bracket-image ${image?"has-image":"is-empty"}">
      <div class="public-bracket-image-head">
        <span>СІТКА ${index+1}</span>
        <b>IMAGE 0${index+1}</b>
      </div>
      ${image
        ? `<a class="bracket-zoom" href="${esc(image)}" data-bracket-image="${esc(image)}">
            <img src="${esc(image)}" alt="Сітка ${index+1} турніру ${esc(tournament.name)}">
          </a>
          <a class="secondary-btn bracket-open-btn" href="${esc(image)}" target="_blank" rel="noopener noreferrer">
            <i data-lucide="external-link"></i><span>Відкрити повністю</span>
          </a>`
        : `<div class="public-bracket-empty">
            <i data-lucide="image-plus"></i>
            <b>Сітка ${index+1}</b>
            <span>Фото ще не додано</span>
          </div>`}
    </section>`).join("")}
</div>`;

bracketRoot.querySelectorAll("[data-bracket-image]").forEach(a=>{
  a.addEventListener("click",event=>{event.preventDefault();openLightbox(a.dataset.bracketImage)});
});

function openLightbox(src){
  if(!bracketLightbox||!bracketLightboxImg||!src)return;
  bracketLightboxImg.src=src;
  bracketLightbox.classList.add("is-open");
  bracketLightbox.setAttribute("aria-hidden","false");
  document.body.classList.add("lightbox-open");
}
function closeLightbox(){
  if(!bracketLightbox)return;
  bracketLightbox.classList.remove("is-open");
  bracketLightbox.setAttribute("aria-hidden","true");
  if(bracketLightboxImg)bracketLightboxImg.src="";
  document.body.classList.remove("lightbox-open");
}
bracketLightboxClose?.addEventListener("click",closeLightbox);
bracketLightbox?.addEventListener("click",event=>{if(event.target===bracketLightbox)closeLightbox()});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&bracketLightbox?.classList.contains("is-open"))closeLightbox();
});

const rules=(tournament.rules_text||"").trim();
rulesRoot.innerHTML=rules
  ? rules.split(/\n{2,}/).map(block=>{
      const lines=block.split(/\n/).map(line=>line.trim()).filter(Boolean);
      const isList=lines.length>0&&lines.every(line=>/^([-*•]|\d+[.)])\s+/.test(line));
      if(isList){
        return `<ul class="rules-list">${lines.map(line=>`<li>${esc(line.replace(/^([-*•]|\d+[.)])\s+/,""))}</li>`).join("")}</ul>`;
      }
      return `<p>${esc(block).replace(/\n/g,"<br>")}</p>`;
    }).join("")
  : '<div class="empty-state">Правила для цього турніру ще не додані.</div>';

setupDetailTabs();
window.refreshIcons?.();

function setupDetailTabs(){
  const tabs=[...document.querySelectorAll(".detail-tabs a")];
  const sections=["teamsSection","bracketSection","rulesSection"].map(id=>document.getElementById(id)).filter(Boolean);
  if(!tabs.length||!sections.length)return;
  const setActive=id=>tabs.forEach(a=>a.classList.toggle("is-active",a.getAttribute("href")==="#"+id));
  tabs.forEach(a=>a.addEventListener("click",()=>setActive(String(a.getAttribute("href")).slice(1))));
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting)setActive(entry.target.id)});
  },{rootMargin:"-45% 0px -50% 0px",threshold:0});
  sections.forEach(section=>observer.observe(section));
  setActive("teamsSection");
}
