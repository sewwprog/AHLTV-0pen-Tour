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
const detailNav=document.querySelector(".detail-tabs");
const detailSections=[...document.querySelectorAll("#teamsSection, #bracketSection, #rulesSection")];

function showUnavailable(message){
  hero.innerHTML=`<div class="empty-state error">${esc(message)}</div>`;
  detailNav.hidden=true;
  detailSections.forEach(section=>{section.hidden=true});
}

function setupSectionNavigation(){
  const links=[...detailNav.querySelectorAll('a[href^="#"]')];
  const sectionFor=hash=>detailSections.find(section=>"#"+section.id===hash);
  let frame=0,requestedSection=null,navigating=false,settleTimer=0;

  function updateCurrentSection(){
    // The marker sits below both the sticky header and the section links.
    const marker=detailNav.getBoundingClientRect().bottom+24;
    let current=detailSections[0];
    detailSections.forEach(section=>{
      if(section.getBoundingClientRect().top<=marker)current=section;
    });
    const atBottom=window.scrollY>0&&window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2;
    if(atBottom)current=detailSections[detailSections.length-1];
    // Short pages can reach the bottom before the selected section reaches the marker.
    if(requestedSection)current=requestedSection;
    links.forEach(link=>{
      if(link.getAttribute("href")==="#"+current.id)link.setAttribute("aria-current","location");
      else link.removeAttribute("aria-current");
    });
  }

  function scheduleUpdate(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;updateCurrentSection()});
  }
  function waitForNavigation(){
    navigating=true;
    clearTimeout(settleTimer);
    settleTimer=setTimeout(()=>{navigating=false},180);
  }
  function selectSection(section){
    requestedSection=section;
    waitForNavigation();
    scheduleUpdate();
  }
  function releaseSelection(){
    if(!requestedSection)return;
    requestedSection=null;
    navigating=false;
    clearTimeout(settleTimer);
    scheduleUpdate();
  }

  detailNav.addEventListener("click",event=>{
    const link=event.target.closest('a[href^="#"]');
    const section=link&&sectionFor(link.getAttribute("href"));
    if(section)selectSection(section);
  });
  window.addEventListener("hashchange",()=>{
    const section=sectionFor(location.hash);
    if(section)selectSection(section);
    else releaseSelection();
  });
  window.addEventListener("scroll",()=>{
    if(requestedSection){
      if(navigating)waitForNavigation();
      else requestedSection=null;
    }
    scheduleUpdate();
  },{passive:true});
  // User-initiated scrolling should take over from an earlier anchor selection.
  window.addEventListener("wheel",releaseSelection,{passive:true});
  window.addEventListener("touchmove",releaseSelection,{passive:true});
  window.addEventListener("keydown",event=>{
    if(["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key))releaseSelection();
  });
  document.addEventListener("pointerdown",event=>{if(!detailNav.contains(event.target))releaseSelection()});
  window.addEventListener("resize",()=>{releaseSelection();scheduleUpdate()});
  updateCurrentSection();

  // Content is loaded asynchronously, so restore a direct link after it renders.
  const target=sectionFor(location.hash);
  if(target){
    selectSection(target);
    requestAnimationFrame(()=>target.scrollIntoView({block:"start",behavior:"instant"}));
  }
}

async function loadTournament(){
  if(!Number.isFinite(id)||id<=0){
    showUnavailable("Турнір не знайдено.");
    return;
  }

  const [tournamentRequest,teamsRequest]=await Promise.allSettled([
    supabase.from("tournaments").select("*").eq("id",id).eq("is_visible",true).maybeSingle(),
    supabase.rpc("get_public_teams")
  ]);
  const {data:tournament,error:tErr}=tournamentRequest.status==="fulfilled"
    ? tournamentRequest.value : {data:null,error:true};
  const {data:teams,error:teamErr}=teamsRequest.status==="fulfilled"
    ? teamsRequest.value : {data:null,error:true};
  if(tErr){
    showUnavailable("Не вдалося завантажити турнір. Спробуй оновити сторінку.");
    return;
  }
  if(!tournament){
    showUnavailable("Турнір не знайдено або він прихований.");
    return;
  }

  const logo=safeUrl(tournament.logo_url);
  const registrationOpen=tournament.registration_open&&["registration","live"].includes(tournament.status);
  const statusLabel=({upcoming:"НЕЗАБАРОМ",registration:registrationOpen?"РЕЄСТРАЦІЯ ВІДКРИТА":"РЕЄСТРАЦІЯ ЗАКРИТА",live:"LIVE",finished:"ЗАВЕРШЕНО"})[tournament.status]||String(tournament.status||"ТУРНІР").toUpperCase();
  const startDate=tournament.starts_at?new Date(tournament.starts_at):null;
  const startLabel=startDate&&!Number.isNaN(startDate.getTime())
    ? startDate.toLocaleString("uk-UA",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})
    : "Дату не вказано";

  hero.innerHTML=`
    <div class="detail-logo ${logo?"has-logo":""}">
      ${logo?`<img src="${esc(logo)}" alt="Логотип ${esc(tournament.name)}">`:esc((tournament.short_name||tournament.name||"A").slice(0,1).toUpperCase())}
    </div>
    <div class="detail-hero-copy">
      <div class="detail-heading">
        <small>${esc(tournament.game)} · ${esc(tournament.format)}</small>
        <h1>${esc(tournament.name)}</h1>
        <p>${esc(tournament.description||"")}</p>
      </div>
      <div class="tournament-meta">
        <span><i data-lucide="gamepad-2"></i>${esc(tournament.game)}</span>
        <span><i data-lucide="swords"></i>${esc(tournament.format)}</span>
        <span><i data-lucide="users"></i>до ${esc(tournament.max_teams)} команд</span>
        <span class="detail-meta-status ${registrationOpen?"is-open":""}"><i data-lucide="circle-dot"></i>${esc(statusLabel)}</span>
        <span><i data-lucide="calendar-days"></i>${esc(startLabel)}</span>
      </div>
    </div>
    ${registrationOpen
      ? '<a class="primary-btn detail-apply" href="apply.html?tournament='+encodeURIComponent(tournament.id)+'"><i data-lucide="send-horizontal"></i><span>Подати заявку</span></a>'
      : '<div class="detail-registration-closed"><i data-lucide="lock-keyhole"></i><span>Реєстрація зараз недоступна</span></div>'}
  `;

  const teamsUnavailable=!!teamErr||!Array.isArray(teams);
  const tournamentTeams=(Array.isArray(teams)?teams:[]).filter(team=>team.tournament_id===id);
  teamsCount.textContent=teamsUnavailable?"—":`${tournamentTeams.length} / ${tournament.max_teams}`;
  teamsCount.setAttribute("aria-label",teamsUnavailable?"Кількість команд недоступна":`${tournamentTeams.length} з ${tournament.max_teams} команд`);

  teamsRoot.innerHTML=teamsUnavailable
    ? '<div class="empty-state">Не вдалося завантажити команди.</div>'
    : tournamentTeams.length
    ? tournamentTeams.map(team=>{
        const teamLogo=safeUrl(team.team_logo_url);
        const fallback=(team.team_tag||team.team_name||"A").slice(0,2).toUpperCase();
        return `<div class="detail-team-row">
          <span class="detail-team-logo ${teamLogo?"has-logo":""}">${teamLogo?`<img src="${esc(teamLogo)}" alt="Логотип ${esc(team.team_name)}">`:esc(fallback)}</span>
          <b><span class="detail-team-name">${esc(team.team_name)}</span>${team.team_tag?`<small>[${esc(team.team_tag)}]</small>`:""}</b>
        </div>`;
      }).join("")
    : '<div class="empty-state">Підтверджених команд ще немає.</div>';

  const bracketSlots=[
    safeUrl(tournament.bracket_image_url),
    safeUrl(tournament.bracket_image_url_2)
  ];
  const allBracketsEmpty=bracketSlots.every(image=>!image);
  bracketRoot.innerHTML=`<div class="public-bracket-gallery has-two ${allBracketsEmpty?"all-empty":""}">
    ${bracketSlots.map((image,index)=>`
      <section class="public-bracket-image ${image?"has-image":"is-empty"}">
        <div class="public-bracket-image-head">
          <span>СІТКА ${index+1}</span>
          <b>IMAGE 0${index+1}</b>
        </div>
        ${image
          ? `<a href="${esc(image)}" target="_blank" rel="noopener noreferrer" aria-label="Відкрити сітку ${index+1} у новій вкладці">
              <img src="${esc(image)}" alt="Сітка ${index+1} турніру ${esc(tournament.name)}">
            </a>
            <a class="secondary-btn bracket-open-btn" href="${esc(image)}" target="_blank" rel="noopener noreferrer" aria-label="Відкрити сітку ${index+1} повністю у новій вкладці">
              <i data-lucide="external-link"></i><span>Відкрити повністю</span>
            </a>`
          : `<div class="public-bracket-empty">
              <i data-lucide="image-plus"></i>
              <b>Сітка ${index+1}</b>
              <span>Фото ще не додано</span>
            </div>`}
      </section>`).join("")}
  </div>`;

  const rules=(tournament.rules_text||"").trim();
  rulesRoot.classList.toggle("is-empty",!rules);
  rulesRoot.innerHTML=rules
    ? rules.split(/\n{2,}/).map(block=>`<p>${esc(block).replace(/\n/g,"<br>")}</p>`).join("")
    : '<div class="empty-state">Правила для цього турніру ще не додані.</div>';

  window.refreshIcons?.();
  setupSectionNavigation();
}

loadTournament();
