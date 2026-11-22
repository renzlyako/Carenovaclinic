#!/usr/bin/env bash
# Restore from a .sql backup. ⚠️ Use on a test/dev database first.
# Usage: ./scripts/restore.sh backups/<file>.sql
set -euo pipefail
source .env.local
[ $# -eq 1 ] || { echo "Usage: $0 <backup.sql>"; exit 1; }
psql "$SUPABASE_DB_URL" -f "$1"
echo "Restore done."