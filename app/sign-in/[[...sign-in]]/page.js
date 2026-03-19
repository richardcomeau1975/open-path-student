import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-page)",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "32px", textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-display), 'Lora', serif",
            fontSize: "36px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Open Path
        </h1>
        <svg
          width="120"
          height="20"
          viewBox="0 0 120 20"
          style={{ margin: "0 auto" }}
        >
          <path
            d="M10 15 Q30 5 60 10 Q90 15 110 5"
            stroke="var(--accent-gold)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <SignIn
        routing="path"
        path="/sign-in"
        afterSignInUrl="/dashboard"
      />
    </div>
  );
}
