import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://hfxzdifqcjbslmxffvlf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi";
const USERS_FUNCTION_URL = SUPABASE_URL + "/functions/v1/admin-users";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const applications = document.querySelector("#applications");
const stats = document.querySelector("#stats");
const emptyState = document.querySelector("#emptyState");
const adminEmail = document.querySelector("#adminEmail");
const pendingBadge = document.querySelector("#pendingBadge");
const usersList = document.querySelector("#usersList");
const usersCount = document.querySelector("#usersCount");
const matchForm = document.querySelector("#matchForm");
const matchMessage = document.querySelector("#matchMessage");
const adminMatchesList = document.querySelector("#adminMatchesList");
const adminMatchesCount = document.querySelector("#adminMatchesCount");
const approvedTeams = document.querySelector("#approvedTeams");

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function showLogin(message = "") {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  loginMessage.textContent = message;
}

async function isAdmin(userId) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !error && !!data;
}

function setupTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".admin-tab").forEach((x) => x.classList.add("hidden"));
      button.classList.add("active");
      document.querySelector("#" + button.dataset.tab).classList.remove("hidden");
    });
  });
}

async function openDashboard(user) {
  if (!(await isAdmin(user.id))) {
    await supabase.auth.signOut();
    showLogin("Цей акаунт не має прав адміністратора.");
    return;
  }

  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  adminEmail.textContent = user.email || "";
  setupTabs();

  await Promise.all([loadApplications(), loadUsers(), loadMatches()]);
}

async function loadApplications() {
  const { data, error } = await supabase
    .from("team_registrations")
    .select("*")
    .order("created_at", { ascending:false });

  if (error) {
    applications.innerHTML = '<p class="error">Не вдалося завантажити заявки.</p>';
    return;
  }

  const pending = data.filter(x => x.status === "pending").length;
  const approved = data.filter(x => x.status === "approved").length;
  const rejected = data.filter(x => x.status === "rejected").length;

  pendingBadge.textContent = pending ? String(pending) : "";
  stats.innerHTML = `
    <div><b>${data.length}</b><span>всього</span></div>
    <div><b>${pending}</b><span>очікують</span></div>
    <div><b>${approved}</b><span>підтверджені</span></div>
  `;

  approvedTeams.innerHTML = data
    .filter(x => x.status === "approved")
    .map(x => `<option value="${esc(x.team_name)}"></option>`)
    .join("");

  emptyState.classList.toggle("hidden", data.length !== 0);
  applications.innerHTML = data.map(renderApplication).join("");
  applications.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", handleApplicationAction));
}

function renderApplication(item) {
  const players = Array.isArray(item.players) ? item.players : [];
  const profile = safeUrl(item.captain_profile);

  return `<article class="application">
    <div class="application-head">
      <div>
        <h3>${esc(item.team_name)} <span class="muted">[${esc(item.team_tag)}]</span></h3>
        <div class="meta">#${item.id} · ${new Date(item.created_at).toLocaleString("uk-UA")}</div>
      </div>
      <span class="pill">${esc(item.status)}</span>
    </div>
    <div class="application-grid">
      <div><span>Капітан:</span> ${esc(item.captain_nick)}</div>
      <div><span>Email:</span> ${esc(item.captain_email)}</div>
      <div><span>Контакт:</span> ${esc(item.contact)}</div>
      <div><span>Профіль:</span> ${profile ? '<a href="' + esc(profile) + '" target="_blank" rel="noopener noreferrer">відкрити</a>' : "—"}</div>
    </div>
    <div class="players"><b>Склад:</b> ${players.map(esc).join(", ")}${item.substitute ? " · Заміна: " + esc(item.substitute) : ""}${item.note ? "<br><b>Коментар:</b> " + esc(item.note) : ""}</div>
    <div class="card-actions">
      <button class="btn approve" data-action="approved" data-id="${item.id}">Підтвердити</button>
      <button class="btn reject" data-action="rejected" data-id="${item.id}">Відхилити</button>
      <button class="btn ghost" data-action="pending" data-id="${item.id}">Pending</button>
      <button class="btn ghost" data-action="delete" data-id="${item.id}">Видалити</button>
    </div>
  </article>`;
}

async function handleApplicationAction(event) {
  const id = Number(event.currentTarget.dataset.id);
  const action = event.currentTarget.dataset.action;

  if (action === "delete") {
    if (!confirm("Видалити цю заявку?")) return;
    const { error } = await supabase.from("team_registrations").delete().eq("id", id);
    if (!error) await loadApplications();
    return;
  }

  const { error } = await supabase
    .from("team_registrations")
    .update({ status: action })
    .eq("id", id);

  if (!error) await loadApplications();
}

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function usersRequest(method = "GET", body = null) {
  const token = await getAccessToken();
  if (!token) throw new Error("no_session");

  const response = await fetch(USERS_FUNCTION_URL, {
    method,
    headers: {
      "Authorization": "Bearer " + token,
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "request_failed");
    error.code = data.error || "request_failed";
    throw error;
  }

  return data;
}

async function loadUsers() {
  usersList.innerHTML = '<div class="empty-state">Завантаження...</div>';

  try {
    const data = await usersRequest();
    usersCount.textContent = String(data.users.length);

    if (!data.users.length) {
      usersList.innerHTML = '<div class="empty-state">Акаунтів поки немає.</div>';
      return;
    }

    usersList.innerHTML = data.users.map((user) => `
      <div class="user-row">
        <div class="user-email">
          <b>${esc(user.email || "Без email")}</b>
          <small>Зареєстровано: ${new Date(user.created_at).toLocaleString("uk-UA")}${user.is_self ? " · це ви" : ""}</small>
        </div>
        <span class="role-badge ${user.is_admin ? "admin" : ""}">${user.is_admin ? "ADMIN" : "USER"}</span>
        <button
          class="btn ${user.is_admin ? "reject" : "approve"} user-action"
          data-user-id="${user.id}"
          data-make-admin="${user.is_admin ? "false" : "true"}"
        >${user.is_admin ? "Забрати адмінку" : "Дати адмінку"}</button>
      </div>
    `).join("");

    usersList.querySelectorAll("[data-user-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await usersRequest("POST", {
            user_id: button.dataset.userId,
            make_admin: button.dataset.makeAdmin === "true"
          });
          await loadUsers();
        } catch (error) {
          if (error.code === "last_admin") alert("Не можна забрати права в останнього адміністратора.");
          else alert("Не вдалося змінити права користувача.");
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    console.error(error);
    usersList.innerHTML = '<div class="empty-state error">Не вдалося завантажити користувачів.</div>';
  }
}

function formatMatchDate(value) {
  if (!value) return "Дата не вказана";
  return new Date(value).toLocaleString("uk-UA");
}

async function loadMatches() {
  const { data, error } = await supabase
    .from("tournament_matches")
    .select("*")
    .order("starts_at", { ascending:true, nullsFirst:false })
    .order("created_at", { ascending:true });

  if (error) {
    adminMatchesList.innerHTML = '<div class="empty-state error">Не вдалося завантажити матчі.</div>';
    return;
  }

  adminMatchesCount.textContent = String(data.length);

  if (!data.length) {
    adminMatchesList.innerHTML = '<div class="empty-state">Матчів ще немає.</div>';
    return;
  }

  adminMatchesList.innerHTML = data.map((match) => `
    <div class="admin-match-row">
      <div>
        <b>${esc(match.team_one)} — ${esc(match.team_two)}</b>
        <small>${formatMatchDate(match.starts_at)} · ${esc(match.stage || "без стадії")} · BO${match.best_of} · ${esc(match.status)}</small>
      </div>
      <div class="admin-match-actions">
        <button class="btn ghost" data-match-status="scheduled" data-id="${match.id}">Scheduled</button>
        <button class="btn reject" data-match-status="live" data-id="${match.id}">LIVE</button>
        <button class="btn approve" data-match-status="finished" data-id="${match.id}">Finished</button>
        <button class="btn ghost" data-delete-match="${match.id}">Видалити</button>
      </div>
    </div>
  `).join("");

  adminMatchesList.querySelectorAll("[data-match-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      await supabase.from("tournament_matches")
        .update({ status: button.dataset.matchStatus })
        .eq("id", Number(button.dataset.id));
      await loadMatches();
    });
  });

  adminMatchesList.querySelectorAll("[data-delete-match]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Видалити матч із сайту?")) return;
      await supabase.from("tournament_matches").delete().eq("id", Number(button.dataset.deleteMatch));
      await loadMatches();
    });
  });
}

matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(matchForm).entries());

  const payload = {
    team_one: data.team_one.trim(),
    team_two: data.team_two.trim(),
    starts_at: data.starts_at ? new Date(data.starts_at).toISOString() : null,
    stage: data.stage.trim() || null,
    best_of: Number(data.best_of),
    status: data.status
  };

  matchMessage.textContent = "Додаємо...";

  const { error } = await supabase.from("tournament_matches").insert(payload);

  if (error) {
    console.error(error);
    matchMessage.textContent = "Не вдалося додати матч.";
    matchMessage.className = "error";
    return;
  }

  matchForm.reset();
  matchMessage.textContent = "Матч додано на сайт.";
  matchMessage.className = "success";
  await loadMatches();
});

async function getAdminState() {
  const { data, error } = await supabase.rpc("has_ahltv_admin");
  if (error) return true;
  return !!data;
}

async function refreshAuthButton() {
  const hasAdmin = await getAdminState();
  const btn = document.querySelector("#authBtn");
  if (btn) btn.textContent = hasAdmin ? "Увійти" : "Увійти / Зареєструватися";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;
  loginMessage.textContent = "";

  const hasAdmin = await getAdminState();

  if (!hasAdmin) {
    loginMessage.textContent = "Створюємо перший акаунт...";

    const response = await fetch(
      SUPABASE_URL + "/functions/v1/register-first-admin",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (result.error === "admin_exists") {
        await refreshAuthButton();
        loginMessage.textContent = "Адмін уже створений. Увійди в акаунт.";
      } else {
        loginMessage.textContent = "Не вдалося зареєструватися.";
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      loginMessage.textContent = "Акаунт створено. Спробуй увійти ще раз.";
      await refreshAuthButton();
      return;
    }

    await openDashboard(data.user);
    return;
  }

  loginMessage.textContent = "Вхід...";
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    loginMessage.textContent = "Невірний email або пароль.";
    return;
  }

  await openDashboard(data.user);
});

document.querySelector("#logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
  await refreshAuthButton();
});

const { data:{ session } } = await supabase.auth.getSession();

if (session?.user) {
  await openDashboard(session.user);
} else {
  await refreshAuthButton();
}
