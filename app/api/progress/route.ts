import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic" // data per-user, jangan di-cache

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from("roast_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Gagal ambil data" }, { status: 500 })
  }

  return NextResponse.json({ history: data ?? [] })
}
