#!/usr/bin/env python3
"""Load config/demo-credentials.env into os.environ (required for local dev scripts)."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def repo_root() -> Path:
	return Path(__file__).resolve().parents[1]


def _parse_env_file(path: Path) -> None:
	for raw in path.read_text(encoding="utf-8").splitlines():
		line = raw.strip()
		if not line or line.startswith("#"):
			continue
		if line.startswith("export "):
			line = line[7:].strip()
		if "=" not in line:
			continue
		key, _, value = line.partition("=")
		key = key.strip()
		value = value.strip()
		if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
			value = value[1:-1]
		os.environ.setdefault(key, value)


def load_demo_env(*, require: bool = True) -> Path:
	root = repo_root()
	creds = root / "config" / "demo-credentials.env"
	if not creds.is_file():
		if require:
			sys.exit(
				"Missing config/demo-credentials.env — "
				"copy from config/demo-credentials.env.example"
			)
		return creds
	_parse_env_file(creds)
	optional = root / ".env"
	if optional.is_file():
		_parse_env_file(optional)
	return creds
