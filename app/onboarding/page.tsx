import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase"
import OnboardingForm from "@/components/onboarding-form"

export const dynamic = "force-dynamic" // cek profil per-user tiap kunjungan

// Server component: gerbang sebelum render form. Kalau profil user SUDAH punya
// niche + follower_tier, jangan minta isi ulang — langsung ke "/". Ini bikin
// user yang balik ke /onboarding (mis. via bookmark) gak kejebak ngisi 2x.
export default async function OnboardingPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("niche, follower_tier")
    .eq("user_id", userId)
    .maybeSingle()

  if (profile?.niche && profile?.follower_tier) {
    redirect("/")
  }

  return <OnboardingForm />
}
