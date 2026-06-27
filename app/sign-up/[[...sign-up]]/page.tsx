import { SignUp } from "@clerk/nextjs"

// Catch-all route ([[...sign-up]]) wajib buat Clerk hosted sign-up flow.
export default function SignUpPage() {
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
      <SignUp />
    </main>
  )
}
