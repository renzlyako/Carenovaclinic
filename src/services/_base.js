import "server-only";
import { createClient } from "@/lib/supabase/server";

// Generic CRUD helper. Every query goes through the Supabase client
// (parameterized -> protected against SQL injection) and follows RLS.
export function createCrudService(table, { select = "*", orderBy = "created_at" } = {}) {
  return {
    async list({ page = 1, pageSize = 10, search, searchColumn } = {}) {
      const supabase = await createClient();
      const from = (page - 1) * pageSize;
      let q = supabase.from(table).select(select, { count: "exact" })
        .order(orderBy, { ascending: false })
        .range(from, from + pageSize - 1);
      if (search && searchColumn) q = q.ilike(searchColumn, `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw new Error(error.message);
      return { data, count };
    },
    async getById(id) {
      const supabase = await createClient();
      const { data, error } = await supabase.from(table).select(select).eq("id", id).single();
      if (error) throw new Error(error.message);
      return data;
    },
    async create(values) {
      const supabase = await createClient();
      const { data, error } = await supabase.from(table).insert(values).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    async update(id, values) {
      const supabase = await createClient();
      const { data, error } = await supabase.from(table).update(values).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    async remove(id) {
      const supabase = await createClient();
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
