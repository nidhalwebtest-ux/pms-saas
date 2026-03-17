import LoginForm from "./LoginForm";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await props.searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* Background orbs — match landing page hero */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-2xl" />

      <LoginForm initialError={params.error} initialSuccess={params.success} />
    </div>
  );
}