import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabase=createClient("https://hfxzdifqcjbslmxffvlf.supabase.co","sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi");
const root=document.querySelector("#tournamentsList");
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeHttpUrl=v=>{try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:null}catch{return null}};
const isRegistrationOpen=t=>t.registration_open&&["registration","live"].includes(t.status);
const dateValue=v=>{const date=v?new Date(v):null;return date&&!Number.isNaN(date.getTime())?date:null};
const dateLabel=v=>{const date=dateValue(v);return date?date.toLocaleString("uk-UA",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Дату не вказано"};
const detailUrl=t=>`tournament.html?id=${encodeURIComponent(t.id)}`;
const applyUrl=t=>`apply.html?tournament=${encodeURIComponent(t.id)}`;

function tournamentLogo(t){
  const logo=safeHttpUrl(t.logo_url);
  if(logo)return `<div class="event-logo has-logo"><img src="${esc(logo)}" alt="Логотип ${esc(t.name)}"></div>`;
  return `<div class="event-logo" aria-hidden="true">${esc(String(t.short_name||t.name||"A").slice(0,1).toUpperCase())}</div>`;
}

function renderCard(t,allTeams,allMatches,teamsAvailable){
  const teams=allTeams.filter(x=>x.tournament_id===t.id);
  const matches=allMatches.filter(x=>x.tournament_id===t.id);
  const maxTeams=Math.max(0,Number(t.max_teams)||0);
  const registrationOpen=isRegistrationOpen(t);
  const statusLabel=t.status==="registration"
    ? (registrationOpen?"Реєстрація відкрита":"Реєстрація закрита")
    : ({upcoming:"Незабаром",live:"Триває",finished:"Завершено"}[t.status]||String(t.status||"Турнір"));
  const statusClass=registrationOpen?"is-open":t.status==="live"?"is-live":"is-muted";
  const teamCount=teamsAvailable?String(teams.length):"—";
  const teamMarkup=teams.map(team=>{
    const logo=safeHttpUrl(team.team_logo_url);
    const initial=String(team.team_name||team.team_tag||"?").slice(0,1).toUpperCase();
    return `<li class="event-team"><span class="event-team-logo" aria-hidden="true">${logo?`<img src="${esc(logo)}" alt="">`:esc(initial)}</span><span class="event-team-name">${esc(team.team_name)}</span>${team.team_tag?`<small>${esc(team.team_tag)}</small>`:""}</li>`;
  }).join("");
  const teamsMarkup=teamsAvailable&&teams.length
    ? `<details class="event-disclosure"><summary aria-label="Команди турніру ${esc(t.name)}"><span>Команди</span><i data-lucide="chevron-right"></i></summary><ul class="event-team-list">${teamMarkup}</ul></details>`
    : `<span class="event-empty">${teamsAvailable?"Підтверджених команд ще немає.":"Не вдалося завантажити команди."}</span>`;
  const matchesMarkup=matches.length
    ? `<details class="event-disclosure event-matches"><summary aria-label="Матчі турніру ${esc(t.name)}"><span>Матчі <small>${matches.length}</small></span><i data-lucide="chevron-right"></i></summary><div class="event-match-list">${matches.map(m=>`<div class="event-match"><span>${esc(m.starts_at?dateLabel(m.starts_at):"TBA")}</span><b>${esc(m.team_one)} <i>vs</i> ${esc(m.team_two)}</b><strong class="${m.status==="live"?"live-text":""}">${m.status==="live"?"LIVE":"BO"+esc(m.best_of)}</strong></div>`).join("")}</div></details>`
    : "";

  return `<article class="panel tournament-card event-card">
    <div class="event-main">
      <div class="event-heading">
        ${tournamentLogo(t)}
        <div class="event-title">
          <h3><a href="${detailUrl(t)}">${esc(t.name)}</a></h3>
          <div class="event-meta" role="group" aria-label="Інформація про турнір">
            <span>${esc(t.game||"Гра не вказана")} · ${esc(t.format||"—")}</span>
            <span>${teamCount} / ${maxTeams||"—"} команд</span>
            <span>${esc(dateLabel(t.starts_at))}</span>
          </div>
          ${t.description?`<p>${esc(t.description)}</p>`:""}
        </div>
        <span class="event-status ${statusClass}"><span aria-hidden="true"></span>${esc(statusLabel)}</span>
      </div>
      <div class="event-footer">
        <div class="event-disclosures">${teamsMarkup}${matchesMarkup}</div>
        <div class="event-actions">
          ${registrationOpen?`<a class="primary-btn" href="${applyUrl(t)}"><span>Подати заявку</span><i data-lucide="arrow-right"></i></a>`:""}
          <a class="secondary-btn" href="${detailUrl(t)}"><span>Деталі турніру</span><i data-lucide="arrow-right"></i></a>
        </div>
      </div>
    </div>
  </article>`;
}

function showLoadError(){
  root.innerHTML='<section class="panel home-empty error-state"><div class="home-empty-icon"><i data-lucide="circle-x"></i></div><h3>Не вдалося завантажити турніри</h3><p>Перевір з’єднання та спробуй ще раз.</p><a class="secondary-btn" href="./">Оновити сторінку</a></section>';
  window.refreshIcons?.();
}

async function loadHome(){
  const [{data:tournaments,error:tErr},{data:teams,error:teamsError},{data:matches}]=await Promise.all([
    supabase.from("tournaments").select("*").eq("is_visible",true).order("created_at",{ascending:false}),
    supabase.rpc("get_public_teams"),
    supabase.from("tournament_matches").select("*").eq("is_visible",true).order("starts_at",{ascending:true,nullsFirst:false})
  ]);
  if(tErr||!tournaments){showLoadError();return}

  const allTeams=teams||[];
  const teamsAvailable=!teamsError&&Array.isArray(teams);
  root.innerHTML=tournaments.length
    ? tournaments.map(t=>renderCard(t,allTeams,matches||[],teamsAvailable)).join("")
    : '<section class="panel home-empty"><div class="home-empty-icon"><i data-lucide="trophy"></i></div><h3>Турнірів поки немає</h3><p>Нові змагання з’являться тут. Заглянь трохи пізніше!</p></section>';
  window.refreshIcons?.();
}

loadHome().catch(error=>{console.error(error);showLoadError()});
