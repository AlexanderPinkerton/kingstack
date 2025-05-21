import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatedBorderContainer } from "@/components/ui/animated-border-container";
import { NeonCard } from "@/components/ui/neon-card";
import { GradientText } from "@/components/ui/gradient-text";
import { ThemedInput } from "@/components/ui/themed-input";
import { ThemedButton } from "@/components/ui/themed-button";
import { ThemedOutlineButton } from "@/components/ui/themed-outline-button";
import { ThemedLabel } from "@/components/ui/themed-label";
import { ThemedErrorText } from "@/components/ui/themed-error-text";
import { ThemedSuccessText } from "@/components/ui/themed-success-text";

import { useContext, useState } from "react";
import { SupabaseClientContext } from "@/context/supabaseClientContext";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabase = useContext(SupabaseClientContext);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>("login");
  // Registration/KYC state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function onLogin(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/login",
          // redirectTo: window.location.origin + '/api/auth/loginComplete',
          // scopes: 'email profile',
          // queryParams: {
          //   access_type: 'offline',
          //   prompt: 'consent',
          // },
        },
      });
      if (error) {
        console.error("Error signing in:", error);
      } else {
        console.log("Sign in initiated successfully");
      }
    } catch (err) {
      console.error("Unexpected error during sign in:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        // Basic email/password login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setFormError(error.message);
      } else {
        // Registration with KYC
        if (!email || !password || !fullName || !dob) {
          setFormError("Please fill out all fields.");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { fullName, dob },
          },
        });
        if (error) {
          setFormError(error.message);
        } else {
          setSuccessMsg(
            "Registration successful! Please check your email to confirm your account before logging in."
          );
          // Clear form fields
          setEmail("");
          setPassword("");
          setFullName("");
          setDob("");
          // Optionally switch to login mode after a short delay
          setTimeout(() => {
            setMode("login");
            setSuccessMsg(null);
          }, 5000);
        }
      }
    } catch (err: any) {
      setFormError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-screen", className)} {...props}>
      <AnimatedBorderContainer className="max-w-md w-full">
        <NeonCard className="bg-black/80 backdrop-blur border border-cyan-400/30 shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="mb-6 text-center">
              <GradientText className="text-3xl font-bold tracking-tight">
                {mode === "login" ? "Login to your account" : "Register for Kingstack"}
              </GradientText>
              <div className="mt-2 text-cyan-200 text-sm">
                {mode === "login"
                  ? "Enter your email below to login to your account"
                  : "Sign up with your email and complete KYC to get started."}
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <ThemedLabel htmlFor="email">Email</ThemedLabel>
                <ThemedInput
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <ThemedLabel htmlFor="password">Password</ThemedLabel>
                  {mode === "login" && (
  <a
    href="#"
    className="ml-auto inline-block text-sm underline-offset-4 text-cyan-300 hover:text-purple-400 hover:underline transition"
  >
    Forgot your password?
  </a>
)}
                </div>
                <ThemedInput
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                />
              </div>
              {mode === "register" && (
                <>
                  <div className="grid gap-3">
                    <ThemedLabel htmlFor="fullName">Full Name</ThemedLabel>
                    <ThemedInput
                      id="fullName"
                      type="text"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-3">
                    <ThemedLabel htmlFor="dob">Date of Birth</ThemedLabel>
                    <ThemedInput
                      id="dob"
                      type="date"
                      value={dob}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDob(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <div className="flex flex-col gap-3">
                <ThemedButton
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? (mode === "login" ? "Logging in..." : "Registering...")
                    : (mode === "login" ? "Login" : "Register")}
                </ThemedButton>
                <ThemedOutlineButton
                  onClick={onLogin}
                  disabled={loading}
                  type="button"
                >
                  {loading ? "Redirecting..." : "Login with Google"}
                </ThemedOutlineButton>
              </div>
              {formError && (
                <ThemedErrorText>{formError}</ThemedErrorText>
              )}
              {successMsg && (
                <ThemedSuccessText>{successMsg}</ThemedSuccessText>
              )}
            </div>
            <div className="mt-4 text-center text-sm text-cyan-200">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="underline underline-offset-4 text-cyan-300 hover:text-purple-400 transition"
                    onClick={() => setMode("register")}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="underline underline-offset-4 text-cyan-300 hover:text-purple-400 transition"
                    onClick={() => setMode("login")}
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </form>
        </NeonCard>
      </AnimatedBorderContainer>
    </div>
  );
}
