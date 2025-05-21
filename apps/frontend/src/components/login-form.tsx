import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{mode === "login" ? "Login to your account" : "Register for Kingstack"}</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Enter your email below to login to your account"
              : "Sign up with your email and complete KYC to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              {mode === "register" && (
                <>
                  <div className="grid gap-3">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? (mode === "login" ? "Logging in..." : "Registering...")
                    : (mode === "login" ? "Login" : "Register")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onLogin}
                  disabled={loading}
                  type="button"
                >
                  {loading ? "Redirecting..." : "Login with Google"}
                </Button>
              </div>
              {formError && (
                <div className="text-red-500 text-center text-sm mt-2">{formError}</div>
              )}
              {successMsg && (
                <div className="text-green-500 text-center text-sm mt-2">{successMsg}</div>
              )}
            </div>
            <div className="mt-4 text-center text-sm">
              {mode === "login" ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="underline underline-offset-4 text-cyan-400 hover:text-purple-400"
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
                    className="underline underline-offset-4 text-cyan-400 hover:text-purple-400"
                    onClick={() => setMode("login")}
                  >
                    Login
                  </button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
