import { LoginFooter, LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign In",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/app";
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "OpulentAggro";

  return (
    <div className="login-page">
      <div className="login-card card">
        <header className="page-header">
          <p className="eyebrow">{appName}</p>
          <h1>Sign in</h1>
          <p className="muted">Authenticate with your ERPNext account on Railway.</p>
        </header>

        <LoginForm redirectTo={redirectTo} />
        <LoginFooter />
      </div>
    </div>
  );
}
