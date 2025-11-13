"use client";

import { LoginForm } from "@/components/login/login-form";
import { DefaultNavbar } from "@/components/navbar/presets/default";

import { useContext, useEffect } from "react";
import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { useRouter } from "next/navigation";
import { RootStoreContext } from "@/context/rootStoreContext";
import { observer } from "mobx-react-lite";

export default observer(function Page() {
  const router = useRouter();

  const rootStore = useContext(RootStoreContext);

  useEffect(() => {
    console.log("Login useEffect", rootStore);

    if (rootStore.session) {
      console.log("Session found", rootStore.session);

      router.replace("/home");
    }
  }, [rootStore.session]);

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
