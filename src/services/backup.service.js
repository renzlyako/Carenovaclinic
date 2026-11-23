import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BACKUP_APP, BACKUP_FORMAT_VERSION, BACKUP_TABLES } from "@/lib/utils/backup";


const PAGE = 1000; 

async function fetchAll(admin, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select("*").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function createBackup(createdBy) {
  const admin = createAdminClient();
  const tables = {};
  const rowCounts = {};
  for (const table of BACKUP_TABLES) {
    tables[table] = await fetchAll(admin, table);
    rowCounts[table] = tables[table].length;
  }
  return {
    app: BACKUP_APP,
    format_version: BACKUP_FORMAT_VERSION,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    row_counts: rowCounts,
    tables,
  };
}


export async function restoreBackup(tables) {
  const admin = createAdminClient();
  return admin.rpc("restore_from_backup", { p_data: tables });
}
