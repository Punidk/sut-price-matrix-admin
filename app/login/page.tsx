"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Mail, ArrowRight, Info, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const { login, user, loading, isDemoMode } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/admin");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      router.push("/admin");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password. Please check your credentials.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "Failed to log in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setEmail("admin@sut.ac.th");
    setPassword("admin123");
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
          <span>INITIALIZING SECURITY CHECK...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-white selection:text-black">
      {/* Top Bar / Badge */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2 border-b border-neutral-800 text-xs font-mono text-neutral-400">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SUT STUDENT COUNCIL PRE-AUDIT PORTAL</span>
        </div>
        <div>CONFIDENTIAL / INTERNAL USE ONLY</div>
      </div>

      {/* Main Login Card */}
      <div className="my-auto py-12 flex justify-center items-center">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-none p-8 sm:p-10 shadow-2xl space-y-8">
          
          {/* Header Section */}
          <div className="space-y-3">
            <div className="w-12 h-12 bg-white text-black flex items-center justify-center rounded-none font-bold text-xl mb-6">
              <ShieldCheck className="w-7 h-7 stroke-[2.2]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-mono">
              Central Price Matrix
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed font-sans">
              Log in with your authorized admin credentials to manage and audit standard unit price entries.
            </p>
          </div>

          {/* Demo Notice Banner if Demo Mode */}
          {isDemoMode && (
            <div className="bg-neutral-950 border border-neutral-800 p-3.5 text-xs text-neutral-300 space-y-2">
              <div className="flex items-center space-x-2 font-mono text-white font-semibold">
                <Info className="w-4 h-4 text-white" />
                <span>DEMO PREVIEW ACTIVE</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Firebase keys are pending configuration. You can test authorization instantly using demo credentials.
              </p>
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full mt-1 bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-mono py-1.5 px-3 border border-neutral-700 transition flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Auto-fill Demo Credentials (admin@sut.ac.th)</span>
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs p-3 font-mono flex items-start space-x-2">
              <span className="font-bold text-white uppercase">[ERROR]:</span>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-neutral-300">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sut.ac.th"
                  className="w-full bg-neutral-950 border border-neutral-800 text-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 rounded-none font-sans"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-neutral-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-950 border border-neutral-800 text-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 rounded-none font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-white hover:bg-neutral-200 text-black font-semibold font-mono text-sm py-3 px-4 transition flex items-center justify-center space-x-2 border border-white disabled:opacity-50 disabled:cursor-not-allowed group rounded-none"
            >
              <span>{submitting ? "VERIFYING..." : "SIGN IN TO DASHBOARD"}</span>
              {!submitting && (
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="pt-4 border-t border-neutral-800/60 text-center text-[11px] text-neutral-500 font-mono">
            Suranaree University of Technology • Student Council Pre-Audit System
          </div>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-neutral-600 font-mono py-2">
        © {new Date().getFullYear()} SUT Student Council. All rights reserved.
      </div>
    </main>
  );
}
