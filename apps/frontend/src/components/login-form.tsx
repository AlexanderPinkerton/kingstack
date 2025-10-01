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

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/browserClient";
import { UsernameGenerator } from "@kingstack/shapes";
import { APPNAME } from "@kingstack/shapes";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  // Don't render in playground mode
  if (!supabase) {
    return (
      <div className="text-center text-gray-400">
        <p>Authentication is disabled in playground mode.</p>
        <p>Switch to development mode to use authentication.</p>
      </div>
    );
  }
  const [mode, setMode] = useState<"login" | "register">("login");
  // Registration state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Username validation and suggestions
  const validateUsername = async (username: string) => {
    if (!username) {
      setUsernameError(null);
      return;
    }

    const validation = UsernameGenerator.validateUsername(username);
    if (!validation.isValid) {
      setUsernameError(validation.error || "Invalid username");
      return;
    }

    try {
      const response = await fetch("/api/username/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        setUsernameError(null);
      } else {
        const data = await response.json();
        setUsernameError(data.error || "Username is not available");
      }
    } catch (error) {
      console.error("Username validation error:", error);
      setUsernameError("Error checking username availability");
    }
  };

  // Debounced username validation
  useEffect(() => {
    if (mode === "register" && username) {
      const timeoutId = setTimeout(() => {
        validateUsername(username);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [username, mode]);

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
        // Registration with username
        if (!email || !password || !username) {
          setFormError("Please fill out all fields.");
          setLoading(false);
          return;
        }

        // Check if username is valid and available
        if (usernameError) {
          setFormError("Please fix the username error before continuing.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
            },
          },
        });
        if (error) {
          setFormError(error.message);
        } else {
          setSuccessMsg(
            "Registration successful! Please check your email to confirm your account before logging in.",
          );
          // Clear form fields
          setEmail("");
          setPassword("");
          setUsername("");
          setUsernameError(null);
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
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-screen",
        className,
      )}
      {...props}
    >
      <AnimatedBorderContainer className="max-w-md w-full">
        <NeonCard className="bg-black/80 backdrop-blur border border-cyan-400/30 shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="mb-6 text-center">
              <GradientText className="text-3xl font-bold tracking-tight">
                {mode === "login"
                  ? "Login to your account"
                  : "Register for " + APPNAME}
              </GradientText>
              <div className="mt-2 text-gray-300 text-sm">
                {mode === "login"
                  ? "Enter your email below to login to your account"
                  : "Sign up with your email to get started. You'll verify your identity after registration."}
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <ThemedLabel htmlFor="email" className="text-gray-300">
                  Email
                </ThemedLabel>
                <ThemedInput
                  id="email"
                  type="email"
                  placeholder=""
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  required
                />
              </div>
              {mode === "register" && (
                <div className="grid gap-3">
                  <ThemedLabel htmlFor="username" className="text-gray-300">
                    Username
                  </ThemedLabel>
                  <ThemedInput
                    id="username"
                    type="text"
                    placeholder="Choose a unique username"
                    value={username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setUsername(e.target.value);
                    }}
                    required
                  />
                  {usernameError && (
                    <ThemedErrorText>{usernameError}</ThemedErrorText>
                  )}
                  <div className="text-xs text-gray-400">
                    3-40 characters, letters, numbers, underscores, and hyphens
                    only
                  </div>
                </div>
              )}
              <div className="grid gap-3">
                <div className="flex items-center">
                  <ThemedLabel htmlFor="password" className="text-gray-300">
                    Password
                  </ThemedLabel>
                  {mode === "login" && (
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 text-gray-300 hover:text-[var(--accent-mix)] hover:underline transition"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>
                <ThemedInput
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-3">
                <ThemedButton type="submit" disabled={loading}>
                  {loading
                    ? mode === "login"
                      ? "Logging in..."
                      : "Registering..."
                    : mode === "login"
                      ? "Login"
                      : "Register"}
                </ThemedButton>
                {/* <ThemedOutlineButton
                  onClick={onLogin}
                  disabled={loading}
                  type="button"
                >
                  {loading ? "Redirecting..." : "Login with Google"}
                </ThemedOutlineButton> */}
              </div>
              {formError && <ThemedErrorText>{formError}</ThemedErrorText>}
              {successMsg && (
                <ThemedSuccessText>{successMsg}</ThemedSuccessText>
              )}
            </div>
            <div className="mt-4 text-center text-sm text-gray-300">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4 text-[var(--accent-2-l)] hover:text-[var(--accent-mix)] transition"
                    onClick={() => setMode("register")}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4 text-[var(--accent-2-l)] hover:text-[var(--accent-mix)] transition"
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
