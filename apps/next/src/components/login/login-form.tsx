import { cn } from "@/lib/utils";
import { ThemedInput } from "@/components/ui/themed-input";
import { ThemedButton } from "@/components/ui/themed-button";
import { ThemedLabel } from "@/components/ui/themed-label";
import { ThemedErrorText } from "@/components/ui/themed-error-text";
import { ThemedSuccessText } from "@/components/ui/themed-success-text";

import { useCallback, useEffect, useState } from "react";
import {
  createClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/browserClient";
import { UsernameGenerator } from "@kingstack/shared";
import { APPNAME } from "@kingstack/shared";
import { browserLogger } from "@/lib/browser-logger";
import { fetchPublic } from "@/lib/http/public-fetch";

const logger = browserLogger.child({ component: "LoginForm" });

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabaseConfigured = isSupabaseBrowserConfigured();

  // All hooks must be called before any conditional returns
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  // Registration state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Username validation and suggestions
  const validateUsername = useCallback(async (candidate: string) => {
    if (!candidate) {
      setUsernameError(null);
      return;
    }

    const validation = UsernameGenerator.validateUsername(candidate);
    if (!validation.isValid) {
      setUsernameError(validation.error || "Invalid username");
      return;
    }

    try {
      const response = await fetchPublic("/api/username/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: candidate }),
      });

      if (response.ok) {
        setUsernameError(null);
      } else {
        const data = await response.json();
        setUsernameError(data.error || "Username is not available");
      }
    } catch (error) {
      logger.error("username.validation_failed", { error });
      setUsernameError("Error checking username availability");
    }
  }, []);

  // Debounced username validation
  useEffect(() => {
    if (mode === "register" && username) {
      const timeoutId = setTimeout(() => {
        void validateUsername(username);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [mode, username, validateUsername]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setLoading(true);

    if (!supabaseConfigured) {
      setFormError(
        "Supabase is not configured for this build. Run yarn backend:enable locally or configure the public Supabase environment variables before deploying.",
      );
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

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
            emailRedirectTo: `${window.location.origin}/login`,
            data: {
              username: username,
            },
          },
        });
        if (error) {
          setFormError(error.message);
        } else {
          const confirmationRequired = !data.session;
          setSuccessMsg(
            confirmationRequired
              ? "Registration successful! Please check your email to confirm your account."
              : "Registration successful! You are now signed in.",
          );
          // Clear form fields
          setEmail("");
          setPassword("");
          setUsername("");
          setUsernameError(null);
          if (confirmationRequired) {
            setTimeout(() => {
              setMode("login");
              setSuccessMsg(null);
            }, 5000);
          }
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
      className={cn("flex flex-col items-center justify-center", className)}
      {...props}
    >
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#111216]/90 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-6"
        >
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#f5f2e8]">
              {mode === "login"
                ? "Login to your account"
                : "Register for " + APPNAME}
            </h1>
            <div className="mt-2 text-sm text-white/50">
              {mode === "login"
                ? "Enter your email below to login to your account"
                : "Sign up with your email to get started."}
            </div>
          </div>
          {!supabaseConfigured && (
            <ThemedErrorText>
              Authentication needs the KingStack backend. Run{" "}
              <code>yarn backend:enable</code> locally, or configure Supabase
              before deploying.
            </ThemedErrorText>
          )}
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
              <ThemedButton
                type="submit"
                disabled={loading || !supabaseConfigured}
              >
                {loading
                  ? mode === "login"
                    ? "Logging in..."
                    : "Registering..."
                  : mode === "login"
                    ? "Login"
                    : "Register"}
              </ThemedButton>
            </div>
            {formError && <ThemedErrorText>{formError}</ThemedErrorText>}
            {successMsg && <ThemedSuccessText>{successMsg}</ThemedSuccessText>}
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
      </div>
    </div>
  );
}
