#!/usr/bin/env python3
"""Validate public Compose examples over SSH without Docker daemon access."""

import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys


target = os.environ.get("NAS_SSH_TARGET", "")
if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.@:-]*", target):
    sys.exit("Set NAS_SSH_TARGET to a simple SSH alias or user@hostname")
root = Path(__file__).resolve().parents[2]
names = ["compose.yml", "compose.local.yml", "compose.build.yml", ".env.example", "Caddyfile", "Caddyfile.https"]
payload = {name: (root / "deploy" / name).read_text() for name in names}
remote = r'''
import json, pathlib, subprocess, sys, tempfile
payload = json.load(sys.stdin)
with tempfile.TemporaryDirectory(prefix="elibrary-config-check-") as folder:
    root = pathlib.Path(folder)
    deploy = root / "deploy"
    deploy.mkdir()
    for name, content in payload.items():
        if pathlib.Path(name).name != name:
            raise ValueError("Unexpected filename")
        (deploy / name).write_text(content)
    common = ["docker", "compose", "--env-file", str(deploy / ".env.example")]
    variants = [
        ["-f", str(deploy / "compose.yml")],
        ["-f", str(deploy / "compose.local.yml")],
        ["-f", str(deploy / "compose.yml"), "-f", str(deploy / "compose.build.yml")],
    ]
    for args in variants:
        result = subprocess.run(common + args + ["config", "--quiet"], capture_output=True, text=True)
        if result.returncode:
            sys.stderr.write(result.stderr)
            sys.exit(result.returncode)
    print("PASS: production, local and build Compose configurations. No containers started.")
'''
completed = subprocess.run(
    ["ssh", "-o", "BatchMode=yes", target, "python3", "-c", shlex.quote(remote)],
    input=json.dumps(payload), text=True, check=False,
)
sys.exit(completed.returncode)
