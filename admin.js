import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const applications = document.querySelector("#applications");
const stats = document.querySelector("#stats");
const emptyState = document.querySelector("#emptyState");
const adminEmail = document.querySelector("#adminEmail");
const createAdminBtn = document.querySelector("#createAdminBtn");
const ALLOWED_ADMIN_EMAIL = "tisvitalij05@gmail.com";

const configured = !SUPABASE_URL.includes("REPLACE_") && !SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configured) {
    loginMessage.textContent = "Supabase ще не підключений.";
    return;
  }
  loginMessage.textContent = "Вхід...";
  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;
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
});

if (!configured) {
  showLogin("Supabase ще не підключений.");
} else {
  const { data:{ session } } = await supabase.auth.getSession();
  if (session?.user) await openDashboard(session.user);
}


createAdminBtn?.addEventListener("click", async () => {
  if (!configured) {
    loginMessage.textContent = "Supabase ще не підключений.";
    return;
  }

  const email = document.querySelector("#email").value.trim().toLowerCase();
  const password = document.querySelector("#password").value;

  if (email !== ALLOWED_ADMIN_EMAIL) {
    loginMessage.textContent = "Ця пошта не дозволена для створення адмін-акаунта.";
    return;
  }

  if (password.length < 6) {
    loginMessage.textContent = "Пароль має містити щонайменше 6 символів.";
    return;
  }

  loginMessage.textContent = "Створюємо акаунт...";
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    loginMessage.textContent = error.message.includes("already")
      ? "Акаунт уже існує. Натисни «Увійти»."
      : "Не вдалося створити акаунт: " + error.message;
    return;
  }

  if (data.session && data.user) {
    await openDashboard(data.user);
  } else {
    loginMessage.textContent = "Акаунт створено. Якщо Supabase попросить підтвердити email — відкрий лист, а потім увійди.";
  }
});
