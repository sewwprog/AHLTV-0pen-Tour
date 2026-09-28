# AHLTV Open Tour

Статичний сайт для реєстрації команд на AHLTV Open Tour + Supabase Auth/Database + адмін-панель.

## Уже є
- головна сторінка турніру;
- форма реєстрації команди;
- 5 основних гравців + заміна;
- заявка зберігається в Supabase;
- окрема `admin.html`;
- вхід через Supabase Auth;
- перевірка прав через `admin_users`;
- адмін може підтверджувати, відхиляти та видаляти заявки;
- RLS-політики для захисту даних.

## Підключення Supabase
1. Створити окремий Supabase project.
2. Виконати `supabase/schema.sql`.
3. У `supabase-config.js` вставити Project URL і Publishable key.
4. Створити потрібний акаунт у Supabase Auth.
5. Додати UUID цього користувача в `public.admin_users`.

Паролі та service_role/secret ключі в GitHub не зберігати.
