import LoginForm from "./LoginForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { readAuthFlash } from "@/lib/auth-flash";

export default async function LoginPage() {
  const flash = await readAuthFlash();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* Background orbs — match landing page hero */}
      <div className="pointer-events-none absolute top-1/4 start-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 end-1/4 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 start-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-2xl" />

      {/* Language toggle — top corner */}
      <div className="absolute top-4 end-4 z-10">
        <LanguageSwitcher variant="toggle" />
      </div>

      <LoginForm
        initialError={flash?.error}
        initialWarn={flash?.warn}
        lockoutUntil={flash?.lockoutUntil}
      />
    </div>
  );
}
