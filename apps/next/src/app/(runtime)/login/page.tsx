"use client";

import { LoginForm } from "@/components/login/login-form";
import { DefaultNavbar } from "@/components/navbar/presets/default";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRootStore } from "@/hooks/useRootStore";
import { observer } from "mobx-react-lite";

export default observer(function Page() {
  const router = useRouter();

  const rootStore = useRootStore();

  useEffect(() => {
    if (rootStore.session && !rootStore.isGuest) {
      router.replace("/app");
    }
  }, [rootStore.session, rootStore.isGuest, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090a0c] text-[#f5f2e8]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[40rem] opacity-60"
        style={{
          background:
            "radial-gradient(circle at 72% 12%, rgba(118, 85, 255, 0.22), transparent 30%), radial-gradient(circle at 18% 32%, rgba(216, 255, 112, 0.07), transparent 24%)",
        }}
      />
      <DefaultNavbar navLinks={[]} ctas={[]} specialtyComponents={[]} />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <LoginForm />
        </div>
      </main>
    </div>
  );
});
