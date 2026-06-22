import { createClient } from "@supabase/supabase-js"

// Client ini HANYA dipakai di server (API routes).
// Pakai service role key biar bisa akses tabel tanpa RLS.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
