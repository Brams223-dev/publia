import { Logo } from "@/components/logo";
import { ConfigNotice } from "@/components/config-notice";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Logo className="mb-8" />
      <div className="w-full max-w-md space-y-4">
        <ConfigNotice />
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
