import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const form = document.querySelector("#teamForm");
const message = document.querySelector("#formMessage");
const submitBtn = document.querySelector("#submitBtn");

const configured = !SUPABASE_URL.includes("REPLACE_") && !SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

function setMessage(text, type="") {
  message.textContent = text;
  message.className = type;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configured) {
    setMessage("База ще не підключена. Адміністратор завершує налаштування Supabase.", "error");
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    team_name: data.team_name.trim(),
    team_tag: data.team_tag.trim().toUpperCase(),
    captain_nick: data.captain_nick.trim(),
    captain_email: data.captain_email.trim().toLowerCase(),
    contact: data.contact.trim(),
    captain_profile: data.captain_profile.trim() || null,
    players: [data.player_1,data.player_2,data.player_3,data.player_4,data.player_5].map(v=>v.trim()),
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
