import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://hfxzdifqcjbslmxffvlf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const form = document.querySelector("#teamForm");
const message = document.querySelector("#formMessage");
const submitBtn = document.querySelector("#submitBtn");
const teamsList = document.querySelector("#teamsList");
const teamsCount = document.querySelector("#teamsCount");
const matchesSection = document.querySelector("#matches");
const matchesList = document.querySelector("#matchesList");
const matchesCount = document.querySelector("#matchesCount");

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = type;
}

function formatDate(value) {
  if (!value) return "Дата уточнюється";
  return new Date(value).toLocaleString("uk-UA", {
    day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"
  });
}

async function loadTeams() {
  const { data, error } = await supabase.rpc("get_public_teams");

  if (error) {
    console.error(error);
    teamsList.innerHTML = '<div class="empty-state">Не вдалося завантажити команди.</div>';
    return;
  }

  teamsCount.textContent = `${data.length} / 16`;

  if (!data.length) {
    teamsList.innerHTML = '<div class="empty-state">Підтверджених команд поки немає.</div>';
    return;
  }

  teamsList.innerHTML = data.map((team) => `
    <div class="team-row">
      <div class="team-logo-mini">${esc(team.team_tag.slice(0,1).toUpperCase())}</div>
      <div>
        <b>${esc(team.team_name)}</b>
        <small>[${esc(team.team_tag)}]</small>
      </div>
    </div>
  `).join("");
}

async function loadMatches() {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("is_visible", true)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    matchesSection.classList.add("hidden");
    return;
  }

  if (!data.length) {
    matchesSection.classList.add("hidden");
    return;
  }

  matchesSection.classList.remove("hidden");
  matchesCount.textContent = String(data.length);

  matchesList.innerHTML = data.map((match) => {
    const statusLabel =
      match.status === "live" ? "LIVE" :
      match.status === "finished" ? "FINISHED" : `BO${match.best_of}`;

    const statusClass =
      match.status === "live" ? "match-live" :
      match.status === "finished" ? "match-finished" : "";

    const scoreOne = match.team_one_score ?? "–";
    const scoreTwo = match.team_two_score ?? "–";

    return `
      <article class="match-row-public">
        <div class="match-when">
          <span>${formatDate(match.starts_at)}</span>
          <small>${esc(match.stage || "")}</small>
        </div>
        <div class="match-teams">
          <div class="match-team"><b>${esc(match.team_one)}</b><strong>${scoreOne}</strong></div>
          <div class="match-team"><b>${esc(match.team_two)}</b><strong>${scoreTwo}</strong></div>
        </div>
        <div class="match-info">
          <b class="${statusClass}">${statusLabel}</b>
          <small>BO${match.best_of}</small>
        </div>
      </article>
    `;
  }).join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    team_name: data.team_name.trim(),
    team_tag: data.team_tag.trim().toUpperCase(),
    captain_nick: data.captain_nick.trim(),
    captain_email: data.captain_email.trim().toLowerCase(),
    contact: data.contact.trim(),
    captain_profile: data.captain_profile.trim() || null,
    players: [data.player_1,data.player_2,data.player_3,data.player_4,data.player_5].map(v => v.trim()),
    substitute: data.substitute.trim() || null,
    note: data.note.trim() || null
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Відправляємо...";
  setMessage("");

  const { error } = await supabase.from("team_registrations").insert(payload);

  submitBtn.disabled = false;
  submitBtn.textContent = "Відправити заявку";

  if (error) {
    console.error(error);
    if (error.code === "23505") setMessage("Команда з такою назвою або тегом уже зареєстрована.", "error");
    else setMessage("Не вдалося відправити заявку. Спробуй ще раз.", "error");
    return;
  }

  form.reset();
  setMessage("Заявку прийнято. Адміністрація AHLTV перевірить її.", "success");
});

await Promise.all([loadTeams(), loadMatches()]);
