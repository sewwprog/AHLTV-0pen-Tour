import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const SUPABASE_URL = "https://hfxzdifqcjbslmxffvlf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi";

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const applications = document.querySelector("#applications");
const stats = document.querySelector("#stats");
const emptyState = document.querySelector("#emptyState");
const adminEmail = document.querySelector("#adminEmail");

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function showLogin(message="") {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  loginMessage.textContent = message;
}

async function isAdmin(userId) {
  const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && !!data;
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
  await loadApplications();
}

async function loadApplications() {
  const { data, error } = await supabase.from("team_registrations").select("*").order("created_at", { ascending:false });
  if (error) {
    applications.innerHTML = '<p class="error">Не вдалося завантажити заявки.</p>';
    return;
  }

  const pending = data.filter(x=>x.status==="pending").length;
  const approved = data.filter(x=>x.status==="approved").length;
  const rejected = data.filter(x=>x.status==="rejected").length;
  stats.innerHTML = `
    <div><b>${data.length}</b><span>всього заявок</span></div>
    <div><b>${pending}</b><span>очікують</span></div>
    <div><b>${approved}</b><span>підтверджені</span></div>
  `;

  emptyState.classList.toggle("hidden", data.length !== 0);
  applications.innerHTML = data.map(renderApplication).join("");
  applications.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", handleAction));
}

function esc(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function renderApplication(item) {
  const players = Array.isArray(item.players) ? item.players : [];
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
      <div><span>Профіль:</span> ${item.captain_profile ? '<a href="'+esc(item.captain_profile)+'" target="_blank" rel="noreferrer">відкрити</a>' : "—"}</div>
    </div>
    <div class="players"><b>Склад:</b> ${players.map(esc).join(", ")}${item.substitute ? " · Заміна: "+esc(item.substitute) : ""}${item.note ? "<br><b>Коментар:</b> "+esc(item.note) : ""}</div>
    <div class="card-actions">
      <button class="btn small approve" data-action="approved" data-id="${item.id}">Підтвердити</button>
      <button class="btn small reject" data-action="rejected" data-id="${item.id}">Відхилити</button>
      <button class="btn small ghost" data-action="pending" data-id="${item.id}">Повернути в pending</button>
      <button class="btn small ghost" data-action="delete" data-id="${item.id}">Видалити</button>
    </div>
  </article>`;
}

async function handleAction(event) {
  const id = Number(event.currentTarget.dataset.id);
  const action = event.currentTarget.dataset.action;

  if (action === "delete") {
    if (!confirm("Видалити цю заявку?")) return;
    const { error } = await supabase.from("team_registrations").delete().eq("id", id);
    if (!error) await loadApplications();
    return;
  }

  const { error } = await supabase.from("team_registrations").update({ status: action }).eq("id", id);
  if (!error) await loadApplications();
}


async function getAdminState() {
  const { data, error } = await supabase.rpc("has_ahltv_admin");
  if (error) {
    console.error(error);
    return true;
  }
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
      "https://hfxzdifqcjbslmxffvlf.supabase.co/functions/v1/register-first-admin",
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
      loginMessage.textContent = "Акаунт створено, але автоматичний вхід не вдався. Спробуй увійти ще раз.";
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
