import { SignIn } from "@clerk/nextjs"

// Catch-all route ([[...sign-in]]) wajib buat Clerk hosted sign-in flow.
export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "var(--ink)",
        padding: "32px 16px",
      }}
    >
      <SignIn />
    </main>
  )
}
