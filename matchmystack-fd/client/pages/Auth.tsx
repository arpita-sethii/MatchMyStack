import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch, API_BASE, requestSignupOtp, verifySignupOtp } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

/** Simple email validator (practical, not overly strict) */
function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Basic password scoring (0..4) */
function getPasswordScore(pwd: string) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}
function strengthLabel(score: number) {
  if (score <= 1) return { label: "Very weak", color: "bg-red-500" };
  if (score === 2) return { label: "Weak", color: "bg-orange-400" };
  if (score === 3) return { label: "Good", color: "bg-yellow-400" };
  return { label: "Strong", color: "bg-green-500" };
}

export default function Auth() {
  const { login } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);  // NEW
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  // OTP states
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailValid = isValidEmail(email);
  const pwdScore = getPasswordScore(password);
  const pwdStrength = strengthLabel(pwdScore);

  // countdown timer for resend
  useEffect(() => {
    let t: number | undefined;
    if (resendCooldown > 0) {
      t = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [resendCooldown]);

  const startResendCooldown = (seconds = 30) => {
    setResendCooldown(seconds);
  };

  // NEW: Forgot password handler
  const handleForgotPassword = async () => {
    setMsg(null);
    if (!emailValid) {
      setMsg("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      setMsg(response.message || "Password reset link sent! Check your email.");
    } catch (err: any) {
      console.error("forgot password error", err);
      const body = err?.body ?? err?.message ?? String(err);
      setMsg(`Error: ${JSON.stringify(body)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setMsg(null);
    if (!emailValid) {
      setMsg("Please enter a valid email address.");
      return;
    }
    try {
      setOtpLoading(true);
      await requestSignupOtp(email);
      setOtpSent(true);
      setMsg("OTP sent. Check your email.");
      startResendCooldown(30);
    } catch (err: any) {
      console.error("request OTP error", err);
      const body = err?.body ?? err?.message ?? String(err);
      setMsg(`Failed to send OTP: ${JSON.stringify(body)}`);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtpAndSignup = async () => {
    setMsg(null);

    if (otp.trim().length === 0) {
      setMsg("Enter the OTP sent to your email.");
      return;
    }
    if (pwdScore < 2) {
      setMsg("Choose a stronger password before creating account.");
      return;
    }

    try {
      setOtpLoading(true);
      await verifySignupOtp(email, otp);

      const result = await apiFetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      console.log("signup success", result);
      setMsg("Account created successfully. Please sign in.");
      setIsSignup(false);
      setPassword("");
      setOtp("");
      setOtpSent(false);
    } catch (err: any) {
      console.error("verify/signup error", err);
      const body = err?.body ?? err?.message ?? String(err);
      setMsg(`Error: ${JSON.stringify(body)}`);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!isSignup && pwdScore < 1) {
      setMsg("Please enter your password.");
      return;
    }

    setLoading(true);
    try{
      const body = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const text = await resp.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!resp.ok) {
        const errBody = data || text || resp.statusText;
        throw new Error(JSON.stringify(errBody));
      }

      if (data?.access_token) {
        const token = data.access_token;

        const meResp = await fetch(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meResp.ok) {
          const errText = await meResp.text();
          throw new Error(`Failed fetching user: ${errText || meResp.statusText}`);
        }

        const me = await meResp.json();
        login(token, me);

        // Dispatch site-wide event so other parts (AppShell) can react
        window.dispatchEvent(new CustomEvent("user-login", { detail: me }));

        // clear inline message (we now show a site banner instead)
        setMsg(null);

      } else {
        setMsg("Logged in (no token returned).");
      }
    } catch (err: any) {
      console.error("auth error", err);
      const body = err?.body ?? err?.message ?? String(err);
      setMsg(`Error: ${JSON.stringify(body)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="p-6">
          <CardContent>
            <h2 className="text-2xl font-bold">
              {showForgotPassword ? "Reset Password" : isSignup ? "Create account" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {showForgotPassword 
                ? "Enter your email to receive a password reset link"
                : "Sign in to find teammates, join projects, and match with AI."}
            </p>

            {/* Forgot Password Form */}
            {showForgotPassword && (
              <div className="mt-6 grid gap-3">
                <label className="text-sm">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 ${
                    email.length === 0 ? "" : emailValid ? "border-green-300/80" : "border-red-300"
                  }`}
                  placeholder="you@company.com"
                  required
                />

                <div className="mt-4 flex gap-3">
                  <Button onClick={handleForgotPassword} disabled={loading || !emailValid}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setMsg(null);
                    }}
                  >
                    Back to Login
                  </Button>
                </div>

                {msg && <div className="mt-3 text-sm text-muted-foreground">{msg}</div>}
              </div>
            )}

            {/* Login Form */}
            {!isSignup && !showForgotPassword && (
              <form onSubmit={handleLoginSubmit} className="mt-6 grid gap-3">
                <label className="text-sm">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 ${
                    email.length === 0 ? "" : emailValid ? "border-green-300/80" : "border-red-300"
                  }`}
                  placeholder="you@company.com"
                  required
                />
                <label className="text-sm">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* NEW: Forgot Password Link */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setMsg(null);
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button type="submit" size="lg" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSignup(true);
                      setMsg(null);
                    }}
                  >
                    New? Create account
                  </Button>
                </div>

                {msg && <div className="mt-3 text-sm text-muted-foreground">{msg}</div>}
              </form>
            )}

            {/* Signup flow with OTP */}
            {isSignup && !showForgotPassword && (
              <div className="mt-6 grid gap-3">
                {!otpSent && (
                  <>
                    <label className="text-sm">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="Your name (optional)"
                    />

                    <label className="text-sm">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full rounded-md border px-3 py-2 ${
                        email.length === 0 ? "" : emailValid ? "border-green-300/80" : "border-red-300"
                      }`}
                      placeholder="you@company.com"
                      required
                    />

                    <label className="text-sm">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-md border px-3 py-2 pr-10"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <div>
                          Password strength: <span className="font-medium">{pwdStrength.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{password.length} chars</div>
                      </div>
                      <div className="w-full h-2 rounded bg-muted/30 overflow-hidden">
                        <div
                          className={`${pwdStrength.color} h-2 transition-all`}
                          style={{ width: `${(pwdScore / 4) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <Button onClick={handleRequestOtp} disabled={otpLoading || !emailValid}>
                        {otpLoading ? "Sending OTP..." : "Send OTP to email"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsSignup(false);
                          setMsg(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                {otpSent && (
                  <>
                    <div>
                      <label className="text-sm">Enter OTP sent to {email}</label>
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full rounded-md border px-3 py-2"
                        placeholder="123456"
                      />
                    </div>

                    <div className="flex gap-3 mt-3">
                      <Button onClick={handleVerifyOtpAndSignup} disabled={otpLoading}>
                        {otpLoading ? "Verifying..." : "Verify OTP & Create Account"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                          setMsg(null);
                        }}
                      >
                        Edit details
                      </Button>
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      <button
                        onClick={async () => {
                          if (resendCooldown > 0) return;
                          try {
                            setOtpLoading(true);
                            await requestSignupOtp(email);
                            setMsg("OTP resent. Check your email.");
                            startResendCooldown(30);
                          } catch (err: any) {
                            const body = err?.body ?? err?.message ?? String(err);
                            setMsg(`Failed to resend OTP: ${JSON.stringify(body)}`);
                          } finally {
                            setOtpLoading(false);
                          }
                        }}
                        className={`underline ${resendCooldown > 0 ? "text-muted-foreground pointer-events-none" : ""}`}
                      >
                        {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend OTP"}
                      </button>
                    </div>
                  </>
                )}

                {msg && <div className="mt-3 text-sm text-muted-foreground">{msg}</div>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right-side: Onboarding + Quick Actions */}
        <div className="space-y-4">
          <Card className="p-6">
            <CardContent>
              <h3 className="text-lg font-semibold">Get started</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><strong>1.</strong> Complete your profile — add skills & availability.</li>
                <li><strong>2.</strong> Connect GitHub to import repos & skills automatically.</li>
                <li><strong>3.</strong> Start swiping on Discover and message your first match.</li>
              </ul>
              <div className="mt-4 flex gap-2">
                <Button asChild>
                  <a href="/profile">Complete profile</a>
                </Button>
                <Button variant="ghost" asChild>
                  <a href="/discover">Explore projects</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardContent>
              <h3 className="text-lg font-semibold">Quick actions</h3>
              <div className="mt-3 flex flex-col gap-3">
                <Button asChild size="sm">
                  <a href="/profile">Edit profile</a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/discover">Discover projects</a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href="/chat">Open messages</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
