"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, isDemoMode } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // หากล็อกอินอยู่แล้ว ให้ Redirect ไปที่ /admin/history ทันที
  useEffect(() => {
    if (user) {
      router.replace("/admin/history");
    }
  }, [user, router]);

  // ฟังก์ชันเข้าสู่ระบบด้วย Google (Sign in with Google)
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);

    try {
      if (isFirebaseConfigured && auth) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const result = await signInWithPopup(auth, provider);

        if (result.user) {
          router.replace("/admin/history");
        }
      } else {
        // Fallback สำหรับ Demo Mode (เมื่อยังไม่ได้ผูก Firebase Keys)
        const demoUser = {
          email: "admin.google@sut.ac.th",
          displayName: "SUT Admin (Google)",
          uid: "demo-google-admin-01",
          isDemo: true,
        };
        localStorage.setItem("sut_admin_demo_session", JSON.stringify(demoUser));
        router.replace("/admin/history");
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);

      // จัดการข้อความ Error ให้เข้าใจง่าย
      if (error.code === "auth/popup-closed-by-user") {
        setErrorMessage("การเข้าสู่ระบบถูกยกเลิก (หน้าต่าง Popup ปิดก่อนดำเนินการเสร็จสิ้น)");
      } else if (error.code === "auth/cancelled-popup-request") {
        setErrorMessage("คำขอเข้าสู่ระบบถูกยกเลิก กรุณาลองใหม่อีกครั้ง");
      } else if (error.code === "auth/unauthorized-domain") {
        setErrorMessage("โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Auth (กรุณาเพิ่มใน Authorized Domains)");
      } else if (error.code === "auth/operation-not-allowed") {
        setErrorMessage("ยังไม่ได้เปิดใช้งาน Google Sign-In ใน Firebase Console");
      } else {
        setErrorMessage(error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex items-center justify-center p-4 font-sans selection:bg-neutral-900 selection:text-white">
      <div className="w-full max-w-md bg-white border border-neutral-200 p-8 sm:p-10 space-y-6">
        {/* Header Icon & Branding */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 bg-neutral-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 stroke-[2]" />
            </div>
            <span className="text-[10px] font-mono tracking-wider uppercase text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5">
              {isDemoMode ? "DEMO MODE" : "ADMIN ACCESS"}
            </span>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-neutral-900 uppercase">
              SUT STUDENT COUNCIL - ADMIN PORTAL
            </h1>
            <p className="text-xs text-neutral-500 font-mono mt-1.5 leading-relaxed">
              ระบบจัดการฐานข้อมูลราคากลางและประวัติการตรวจสอบงบประมาณ
            </p>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6 space-y-4">
          {/* Error Message Notice */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 flex items-start space-x-2 font-mono leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 font-medium py-3.5 px-4 text-xs font-mono transition flex items-center justify-center space-x-3 group disabled:opacity-50 cursor-pointer"
          >
            {isSigningIn ? (
              <RefreshCw className="w-4 h-4 animate-spin text-neutral-600" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>
              {isSigningIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google (Sign in with Google)"}
            </span>
          </button>

          <p className="text-[11px] text-neutral-400 font-mono text-center">
            เฉพาะบัญชีผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น
          </p>
        </div>

        {/* Back to User Scan Link */}
        <div className="pt-4 border-t border-neutral-100 text-center">
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs font-mono text-neutral-500 hover:text-neutral-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับสู่หน้าสแกนเอกสาร User</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
