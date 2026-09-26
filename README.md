# PC Remote Control

Supabase project already connected:

- URL: `https://hfxzdifqcjbslmxffvlf.supabase.co`
- Device ID: `home-pc`

## GitHub Pages

The web interface is in:

`web/index.html`

Publish that file with GitHub Pages.

## Windows agent

1. Install Python 3.
2. Open `pc-agent`.
3. Run:

```bat
pip install -r requirements.txt
```

4. Copy `.env.example` to `.env`.
5. Put the SAME Supabase email/password that you use on the website.
6. Run:

```bat
start.bat
```

The agent supports:

- Lock
- Sleep
- Restart
- Shutdown

## Important

Do NOT commit `pc-agent/.env`.
It contains your Supabase login password.

The public `sb_publishable_...` key in `index.html` is expected to be public.
Access to rows is protected by Supabase Auth + RLS.

## Powering ON a fully powered-off PC

A fully powered-off PC cannot read Supabase because Python is not running.
For remote power-on from outside home you still need an always-on home device
(router/NAS/Raspberry Pi/another PC) that can send a Wake-on-LAN packet.
