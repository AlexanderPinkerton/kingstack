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
    console.log("Login useEffect", rootStore);

    if (rootStore.session) {
      console.log("Session found", rootStore.session);

      router.replace("/home");
    }
  }, [rootStore.session, rootStore, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 flex flex-col">
      <DefaultNavbar navLinks={[]} ctas={[]} specialtyComponents={[]} />
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-16">
        <div className="w-full max-w-md mx-auto">
          <LoginForm />
        </div>
      </main>
    </div>
  );
});
