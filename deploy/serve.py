"""GPU server service (final): backend (uvicorn) + Cloudflare quick tunnel + publish the API address.

Adapted from our elimination-stage demo_service.py.

Statik sayt (HF Static Space) demo serverini `data/api.json` dan topadi. Tezkor tunnel manzili har
qayta ishga tushganda o'zgaradi — shuning uchun bu skript yangi manzilni api.json ga yozib Space'ga
yuklaydi. Jarayonlar o'lsa yoki tunnel tashqaridan javob bermasa — qayta ishga tushiradi.

    python deploy/serve.py      # needs STATE/hf_token.txt (never in git) and cloudflared.exe

Windows'da yoqilganda avtomatik ishga tushadi (schtasks, SYSTEM nomidan) — deploy/README ga qarang.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                                   # repo checkout
STATE = Path(os.environ.get("SJ_STATE", ROOT.parent / "safejunction_state"))   # logs, jobs, token (outside git)
STATE.mkdir(parents=True, exist_ok=True)
SPACE = os.environ.get("SJ_SPACE", "doppix/safejunction")
PORT = int(os.environ.get("SJ_PORT", 7870))
CLOUDFLARED = Path(os.environ.get("CLOUDFLARED", ROOT.parent / "doppix_site" / "cloudflared.exe"))
CHECK_EVERY = 300          # s — tunnelni tashqaridan tekshirish
LOG = STATE / "service.log"
URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def log(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def start_backend() -> subprocess.Popen:
    env = {**os.environ, "JOBS_DIR": str(STATE / "jobs"), "SITE_DIST": str(STATE / "no_dist"),
           "YOLO_CONFIG_DIR": str(STATE / "ultralytics"), "PYTHONUNBUFFERED": "1"}
    out = open(STATE / "backend.log", "a", encoding="utf-8")
    p = subprocess.Popen([sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", str(PORT),
                          "--app-dir", str(ROOT / "backend")], env=env, stdout=out, stderr=subprocess.STDOUT)
    log(f"backend pid {p.pid}")
    return p


def start_tunnel() -> tuple[subprocess.Popen, str | None]:
    p = subprocess.Popen([str(CLOUDFLARED), "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{PORT}"],
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="ignore")
    found: list[str] = []

    def reader():
        with open(STATE / "tunnel.log", "a", encoding="utf-8") as f:
            for line in p.stdout:
                f.write(line)
                m = URL_RE.search(line)
                if m and not found:
                    found.append(m.group(0))

    threading.Thread(target=reader, daemon=True).start()
    for _ in range(60):
        if found or p.poll() is not None:
            break
        time.sleep(1)
    url = found[0] if found else None
    log(f"tunnel pid {p.pid} url {url}")
    return p, url


def publish(url: str) -> None:
    """api.json ni Space'ga yuklash (statik sayt demo serverini shundan topadi)."""
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass
    from huggingface_hub import HfApi
    token = (STATE / "hf_token.txt").read_text().strip()
    body = json.dumps({"api": url, "updated": time.strftime("%Y-%m-%dT%H:%M:%S")}).encode()
    HfApi(token=token).upload_file(path_or_fileobj=body, path_in_repo="data/api.json", repo_id=SPACE,
                                   repo_type="space", commit_message="demo server address")
    log(f"published {url}")


def healthy(url: str) -> bool:
    """Tunnel tashqaridan ishlayaptimi. Bu kompyuterning DNS'i yangi manzilni hali bilmasa (getaddrinfo) —
    tunnel aybdor emas, "ishlayapti" deb hisoblaymiz (aks holda manzil bekorga almashib turadi)."""
    import socket
    import urllib.error
    try:
        with urllib.request.urlopen(f"{url}/api/health", timeout=30) as r:
            return r.status == 200
    except urllib.error.URLError as e:
        if isinstance(e.reason, socket.gaierror):
            log(f"health: DNS unknown here ({e.reason}), skipping")
            return True
        log(f"health failed: {e}")
        return False
    except Exception as e:  # noqa: BLE001
        log(f"health failed: {e}")
        return False


def local_ready(timeout: int = 180) -> bool:
    for _ in range(timeout):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=5):
                return True
        except Exception:  # noqa: BLE001
            time.sleep(1)
    return False


def main() -> None:
    backend = start_backend()
    log(f"backend ready: {local_ready()}")
    tunnel, url = start_tunnel()
    last_check = time.time()             # yangi tunnel DNS'i tarqalishi uchun birinchi tekshiruv CHECK_EVERY dan keyin
    published = None
    while True:
        if backend.poll() is not None:
            log("backend died, restarting")
            backend = start_backend()
            local_ready()
        need_new = tunnel.poll() is not None or url is None
        if not need_new and time.time() - last_check > CHECK_EVERY:
            last_check = time.time()
            need_new = not (healthy(url) or (time.sleep(30) or healthy(url)))   # ikki marta — tasodifiy xato uchun
        if need_new:
            log("tunnel restart")
            tunnel.kill()
            time.sleep(3)
            tunnel, url = start_tunnel()
            last_check = time.time()
        if url and url != published:
            time.sleep(10)                     # DNS yangi manzilni tarqatishi uchun
            try:
                publish(url)
                published = url
            except Exception as e:  # noqa: BLE001
                log(f"publish failed: {e}")
        time.sleep(20)


if __name__ == "__main__":
    main()
