import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabase=createClient("https://hfxzdifqcjbslmxffvlf.supabase.co","sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi");
const root=document.querySelector("#tournamentsList");
const summary=document.querySelector("#homeRegistrationSummary");
const count=document.querySelector("#tournamentCount");
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const safeHttpUrl=v=>{try{const u=new URL(v);return ["http:","https:"].includes(u.protocol)?u.href:null}catch{return null}};
const statusLabel=s=>({upcoming:"НЕЗАБАРОМ",registration:"РЕЄСТРАЦІЯ",live:"LIVE",finished:"ЗАВЕРШЕНО"}[s]||String(s||"ТУРНІР").toUpperCase());
const isRegistrationOpen=t=>t.registration_open&&["registration","live"].includes(t.status);
const dateValue=v=>{const date=v?new Date(v):null;return date&&!Number.isNaN(date.getTime())?date:null};
const dateLabel=v=>{const date=dateValue(v);return date?date.toLocaleString("uk-UA",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Дату не вказано"};
const shortDateLabel=v=>{const date=dateValue(v);return date?date.toLocaleDateString("uk-UA",{day:"numeric",month:"long"}):"дату не вказано"};
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
  const filled=teams.length;
  const seatsLeft=Math.max(0,maxTeams-filled);
  const seatPercent=maxTeams?Math.min(100,Math.round((filled/maxTeams)*100)):0;
  const registrationOpen=isRegistrationOpen(t);
  const status=["upcoming","registration","live","finished"].includes(t.status)?t.status:"unknown";
  const teamCount=teamsAvailable?String(filled):"—";
  const teamMarkup=teamsAvailable
    ? (teams.length?teams.map(team=>{
        const logo=safeHttpUrl(team.team_logo_url);
        return `<span class="event-team">${logo?`<img src="${esc(logo)}" alt="">`:""}${team.team_tag?`<b>${esc(team.team_tag)}</b>`:""}<span>${esc(team.team_name)}</span></span>`;
      }).join(""):'<span class="event-empty">Підтверджених команд ще немає.</span>')
    : '<span class="event-empty">Не вдалося завантажити команди.</span>';
  const matchesMarkup=matches.length?`<div class="event-matches"><div class="event-list-heading"><span>НАЙБЛИЖЧІ МАТЧІ</span><b>${matches.length}</b></div>${matches.map(m=>`<div class="event-match"><span>${esc(m.starts_at?dateLabel(m.starts_at):"TBA")}</span><b>${esc(m.team_one)} <i>vs</i> ${esc(m.team_two)}</b><strong class="${m.status==="live"?"live-text":""}">${m.status==="live"?"LIVE":"BO"+esc(m.best_of)}</strong></div>`).join("")}</div>`:"";

  return `<article class="panel tournament-card event-card">
    <div class="event-main">
      <div class="event-heading">
        ${tournamentLogo(t)}
        <div class="event-title"><span class="event-category">${esc(t.game||"ГРА")} <i>/</i> ${esc(t.format||"ФОРМАТ")}</span><h3><a href="${detailUrl(t)}">${esc(t.name)}</a></h3>${t.description?`<p>${esc(t.description)}</p>`:""}</div>
        <span class="status-badge status-${status}"><span></span>${esc(statusLabel(t.status))}</span>
      </div>
      <div class="event-meta">
        <div><span>ГРА / ФОРМАТ</span><strong>${esc(t.game||"—")} <i>·</i> ${esc(t.format||"—")}</strong></div>
        <div><span>КОМАНДИ</span><strong>${teamCount} <i>/</i> ${maxTeams||"—"}</strong></div>
        <div><span>ПОЧАТОК</span><strong>${esc(dateLabel(t.starts_at))}</strong></div>
      </div>
      <div class="event-teams"><div class="event-list-heading"><span>КОМАНДИ-УЧАСНИЦІ</span><b>${teamCount} / ${maxTeams||"—"}</b></div><div class="event-team-list">${teamMarkup}</div></div>
      ${matchesMarkup}
    </div>
    <aside class="event-aside">
      <div class="event-seats-label">МІСЦЯ КОМАНД</div>
      <div class="event-seats">${teamCount} <span>/ ${maxTeams||"—"}</span></div>
      <div class="event-progress"${teamsAvailable&&maxTeams?` role="progressbar" aria-label="Заповнення турніру" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${seatPercent}"`:""}><span style="width:${teamsAvailable?seatPercent:0}%"></span></div>
      <div class="event-seats-caption">${!teamsAvailable?"Дані про місця недоступні":seatsLeft>0?`Залишилось місць: ${seatsLeft}`:"Вільних місць немає"}</div>
      <div class="event-registration ${registrationOpen?"is-open":"is-closed"}"><span></span>${registrationOpen?"Реєстрація відкрита":"Реєстрація закрита"}</div>
      <div class="event-actions">
        ${registrationOpen?`<a class="primary-btn" href="${applyUrl(t)}"><span>Подати заявку</span><i data-lucide="arrow-right"></i></a>`:""}
        <a class="secondary-btn" href="${detailUrl(t)}"><span>Деталі турніру</span><i data-lucide="arrow-right"></i></a>
      </div>
    </aside>
  </article>`;
}

function showLoadError(){
  if(count)count.textContent="—";
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
  if(count)count.textContent=String(tournaments.length).padStart(2,"0");

  const featured=tournaments.find(isRegistrationOpen);
  if(summary&&featured){
    const registered=teamsAvailable?allTeams.filter(x=>x.tournament_id===featured.id).length:"—";
    summary.classList.remove("hidden");
    summary.innerHTML=`<div class="home-registration-copy"><span class="registration-live-dot"></span><b>Реєстрація відкрита</b><span class="summary-separator">·</span><strong>${registered}/${Number(featured.max_teams)||"—"} місць</strong><span class="summary-separator">·</span><span>Старт: ${esc(shortDateLabel(featured.starts_at))}</span></div><a href="${applyUrl(featured)}"><span>${esc(featured.name)}</span><i data-lucide="arrow-right"></i></a>`;
  }

  root.innerHTML=tournaments.length
    ? tournaments.map(t=>renderCard(t,allTeams,matches||[],teamsAvailable)).join("")
    : '<section class="panel home-empty"><div class="home-empty-icon"><i data-lucide="trophy"></i></div><h3>Турнірів поки немає</h3><p>Нові змагання з’являться тут. Заглянь трохи пізніше!</p></section>';
  window.refreshIcons?.();
}

loadHome().catch(error=>{console.error(error);showLoadError()});
