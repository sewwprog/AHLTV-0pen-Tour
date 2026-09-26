import os
import time
import socket
import ctypes
import subprocess
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = "https://hfxzdifqcjbslmxffvlf.supabase.co"
PUBLISHABLE_KEY = "sb_publishable_Z3cDbEmw_8OcJsXAwypOfw_-IwC-RFi"
EMAIL = os.environ["SUPABASE_EMAIL"]
PASSWORD = os.environ["SUPABASE_PASSWORD"]
DEVICE_ID = os.getenv("DEVICE_ID", "home-pc")
DEVICE_NAME = os.getenv("DEVICE_NAME", socket.gethostname())
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "2"))

REST = f"{SUPABASE_URL}/rest/v1"
AUTH = f"{SUPABASE_URL}/auth/v1"
access_token = None
user_id = None

def sign_in():
    global access_token, user_id
    r = requests.post(
        f"{AUTH}/token?grant_type=password",
        headers={"apikey": PUBLISHABLE_KEY, "Content-Type": "application/json"},
        json={"email": EMAIL, "password": PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    access_token = data["access_token"]
    user_id = data["user"]["id"]

def headers(prefer=None):
    h = {
        "apikey": PUBLISHABLE_KEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h

def register_device():
    payload = {
        "id": DEVICE_ID,
        "user_id": user_id,
        "name": DEVICE_NAME,
        "status": "online",
    }
    r = requests.post(
        f"{REST}/pc_devices?on_conflict=id",
        headers=headers("resolution=merge-duplicates,return=minimal"),
        json=payload,
        timeout=12,
    )
    r.raise_for_status()
    heartbeat()

def heartbeat():
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    r = requests.patch(
        f"{REST}/pc_devices?id=eq.{DEVICE_ID}",
        headers=headers("return=minimal"),
        json={"status": "online", "last_seen": now},
        timeout=12,
    )
    r.raise_for_status()

def next_command():
    params = {
        "device_id": f"eq.{DEVICE_ID}",
        "status": "eq.pending",
        "action": "in.(shutdown,restart,lock,sleep)",
        "order": "created_at.asc",
        "limit": "1",
        "select": "id,action",
    }
    r = requests.get(f"{REST}/pc_commands", headers=headers(), params=params, timeout=12)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None

def update_command(command_id, status, result=None):
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    payload = {"status": status, "processed_at": now}
    if result:
        payload["result"] = result[:500]
    r = requests.patch(
        f"{REST}/pc_commands?id=eq.{command_id}",
        headers=headers("return=minimal"),
        json=payload,
        timeout=12,
    )
    r.raise_for_status()

def execute(action):
    if os.name != "nt":
        raise RuntimeError("This agent is for Windows")

    if action == "lock":
        ctypes.windll.user32.LockWorkStation()
    elif action == "sleep":
        ok = ctypes.windll.powrprof.SetSuspendState(False, False, False)
        if not ok:
            raise RuntimeError("Windows refused sleep mode")
    elif action == "restart":
        subprocess.Popen(["shutdown", "/r", "/t", "0"])
    elif action == "shutdown":
        subprocess.Popen(["shutdown", "/s", "/t", "0"])

def main():
    sign_in()
    register_device()
    print("PC Remote agent started")
    print("Device:", DEVICE_ID)

    last_heartbeat = 0
    while True:
        try:
            now = time.time()
            if now - last_heartbeat >= 10:
                heartbeat()
                last_heartbeat = now

            cmd = next_command()
            if cmd:
                cid = cmd["id"]
                action = cmd["action"]
                update_command(cid, "processing")

                if action in ("shutdown", "restart"):
                    update_command(cid, "done", "Command accepted")
                    execute(action)
                else:
                    try:
                        execute(action)
                        update_command(cid, "done", "Done")
                    except Exception as exc:
                        update_command(cid, "error", str(exc))
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 401:
                sign_in()
            else:
                print("HTTP error:", exc)
        except Exception as exc:
            print("Error:", exc)

        time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()
