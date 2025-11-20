"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  User,
  KeyRound,
  EyeOff,
  View,
  LogIn,
  ShieldCheck,
  Fingerprint,
} from "lucide-react";

type AuthLoginProps = {
  className?: string;
  endpoint?: string;
  title?: string;
  subtitle?: string;
  onSuccess?: (payload: {
    user: { username: string; role: string };
    token?: string | null;
  }) => void;
};

type FieldErrors = Partial<Record<"username" | "password", string>>;

export default function AuthLogin({
  className,
  endpoint = "/api/auth/login",
  title = "Welcome back",
  subtitle = "Sign in to access the admin dashboard",
  onSuccess,
}: AuthLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isDisabled = useMemo(() => {
    if (submitting) return true;
    if (!username || !password) return true;
    return false;
  }, [submitting, username, password]);

  const validate = useCallback((): FieldErrors => {
    const errs: FieldErrors = {};
    const u = username.trim();
    const p = password;

    if (!u) {
      errs.username = "Username is required.";
    } else if (u.length < 3) {
      errs.username = "Username must be at least 3 characters.";
    } else if (u.length > 64) {
      errs.username = "Username cannot exceed 64 characters.";
    }

    if (!p) {
      errs.password = "Password is required.";
    } else if (p.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }

    return errs;
  }, [username, password]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setGeneralError(null);
      const errs = validate();
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;

      setSubmitting(true);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message =
            data?.message ||
            (res.status === 401
              ? "Invalid credentials."
              : "Unable to sign in. Please try again.");
          setGeneralError(message);
          toast.error(message);
          return;
        }

        // Expect server to perform secure password hashing verification and admin role check
        const user = data?.user ?? { username: username.trim(), role: "admin" };
        if (user?.role !== "admin") {
          const msg = "Admin access required.";
          setGeneralError(msg);
          toast.error(msg);
          return;
        }

        toast.success("Signed in successfully", {
          description: "Welcome back!",
          icon: <ShieldCheck className="h-4 w-4 text-primary" />,
        });

        onSuccess?.({
          user,
          token: data?.token ?? null,
        });
      } catch (err) {
        setGeneralError("Network error. Please check your connection.");
        toast.error("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [endpoint, password, username, validate, onSuccess]
  );

  return (
    <Card
      className={[
        "w-full max-w-md bg-card text-card-foreground border border-border shadow-sm",
        "rounded-2xl",
        className || "",
      ].join(" ")}
      aria-label="Admin sign in"
    >
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Fingerprint className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Secure sign in</span>
        </div>
        <CardTitle className="text-xl sm:text-2xl leading-tight">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {subtitle}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {generalError ? (
          <div
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
            role="alert"
            aria-live="polite"
          >
            <p className="text-sm text-destructive">{generalError}</p>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4"
          aria-describedby={generalError ? "form-error" : undefined}
        >
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm">
              Username
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
              <Input
                id="username"
                name="username"
                type="text"
                inputMode="text"
                autoComplete="username"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={!!fieldErrors.username || undefined}
                aria-describedby={
                  fieldErrors.username ? "username-error" : undefined
                }
                className={[
                  "pl-9",
                  fieldErrors.username
                    ? "border-destructive focus-visible:ring-destructive"
                    : "",
                ].join(" ")}
              />
            </div>
            {fieldErrors.username ? (
              <p
                id="username-error"
                className="text-xs text-destructive mt-1"
                role="status"
              >
                {fieldErrors.username}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">
              Password
            </Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </div>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password || undefined}
                aria-describedby={
                  fieldErrors.password ? "password-error" : undefined
                }
                className={[
                  "pl-9 pr-10",
                  fieldErrors.password
                    ? "border-destructive focus-visible:ring-destructive"
                    : "",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <View className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {fieldErrors.password ? (
              <p
                id="password-error"
                className="text-xs text-destructive mt-1"
                role="status"
              >
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={isDisabled}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={submitting || undefined}
          >
            <span className="inline-flex items-center gap-2">
              {submitting ? (
                <span className="relative inline-flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
                    aria-hidden="true"
                  />
                  Signing in...
                </span>
              ) : (
                <>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in
                </>
              )}
            </span>
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Admin access only
        </div>
        <div className="inline-flex items-center gap-1">
          <span className="sr-only">Security</span>
          <Fingerprint className="h-4 w-4" aria-hidden="true" />
          Protected
        </div>
      </CardFooter>
    </Card>
  );
}