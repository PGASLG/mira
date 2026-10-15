import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f4f8ff", padding: 16 }}>
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/icon.png" alt="Mira logo" height={34} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/wordmark.png" alt="Mira" height={26} />
      </a>
      <SignIn appearance={{ variables: { colorPrimary: "#1e7bff", borderRadius: "14px" } }} />
      <p style={{ fontSize: 12.5, color: "#5b6b88" }}>Research only, not investment advice.</p>
    </div>
  );
}
