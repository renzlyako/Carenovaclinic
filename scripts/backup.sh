#!/usr/bin/env bash
# Full database backup using pg_dump (for the defense demo).
# Usage: ./scripts/backup.sh   (requires SUPABASE_DB_URL in .env.local)
set -euo pipefail
source .env.local
mkdir -p backups
FILE="backups/carenova-$(date +%Y%m%d-%H%M%S).sql"
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges -f "$FILE"
echo "Backup saved: $FILE"