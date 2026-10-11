"""Build output (frontend/dist) -> Hugging Face static Space. Keeps data/api.json, which the
GPU server writes (deploy/serve.py), so a site deploy never breaks the live API address.

    HF_TOKEN=... python deploy/push_site.py [space]
"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass
from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
SPACE = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SJ_SPACE", "doppix/safejunction")
README = """---
title: Do'ppiX SafeJunction
emoji: 🚦
colorFrom: yellow
colorTo: red
sdk: static
pinned: true
short_description: Road-safety auditor for any traffic camera
---
Built from https://github.com/ubaydullayevgiyosiddin7-eng/doppix-safejunction
"""
token = os.environ.get("HF_TOKEN") or Path(os.environ["HF_TOKEN_FILE"]).read_text().strip()
api = HfApi(token=token)
with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "site"
    shutil.copytree(ROOT / "frontend" / "dist", out)
    (out / "data" / "api.json").unlink(missing_ok=True)
    (out / "README.md").write_text(README, encoding="utf-8")
    sha = os.environ.get("GITHUB_SHA", "local")[:7]
    api.upload_folder(repo_id=SPACE, repo_type="space", folder_path=str(out), commit_message=f"Deploy {sha}",
                      delete_patterns=["assets/*", "index.html"])
print(f"https://{SPACE.replace('/', '-').lower()}.static.hf.space")
