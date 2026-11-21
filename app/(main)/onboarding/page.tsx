import OnboardingWizard from "./OnboardingWizard";

export default function OnboardingPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      {/* Background orbs — match landing/login style */}
      <div className="pointer-events-none absolute top-1/4 start-1/4 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 end-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 start-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 blur-2xl" />

      <OnboardingWizard />
    </div>
  );
}
