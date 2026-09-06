"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  LogOut,
  Database,
  History,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: contextUser, loading: contextLoading, logout: contextLogout, isDemoMode } = useAuth();

  const [user, setUser] = useState<User | any>(contextUser);
  const [loading, setLoading] = useState(true);

  // 1. ดักจับสถานะล็อกอินด้วย onAuthStateChanged(auth, (user) => ...)
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Demo mode fallback จาก AuthContext
      setUser(contextUser);
      setLoading(contextLoading);
    }
  }, [contextUser, contextLoading]);

  // 2. หากผู้ใช้ยังไม่ได้ล็อกอิน (!user) และไม่ได้อยู่ที่หน้า /admin/login ให้ Redirect กลับไปหน้า /admin/login ทันที
  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== "/admin/login") {
      router.replace("/admin/login");
    } else if (user && pathname === "/admin/login") {
      router.replace("/admin/history");
    }
  }, [user, loading, pathname, router]);

  // ฟังก์ชันออกจากระบบ
  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    await contextLogout();
    router.replace("/admin/login");
  };

  // หากอยู่ที่หน้า /admin/login ให้แสดงเนื้อหาหน้า Login โดยตรง
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // 3. ระหว่างที่รอโหลดสถานะ Auth ให้แสดงข้อความสถานะเรียบๆ
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center font-mono text-xs selection:bg-white selection:text-black">
        <div className="flex items-center space-x-2.5 bg-neutral-900 border border-neutral-800 px-4 py-3">
          <div className="w-3.5 h-3.5 border border-neutral-400 border-t-white rounded-full animate-spin"></div>
          <span className="text-neutral-300">กำลังตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    );
  }

  // หากยังไม่มี user ขณะที่กำลัง redirect
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center font-mono text-xs selection:bg-white selection:text-black">
        <div className="flex items-center space-x-2.5 bg-neutral-900 border border-neutral-800 px-4 py-3">
          <div className="w-3.5 h-3.5 border border-neutral-400 border-t-white rounded-full animate-spin"></div>
          <span className="text-neutral-300">กำลังตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    );
  }

  // 4. หากล็อกอินแล้ว ให้แสดงเนื้อหาหน้า Admin ตามปกติ พร้อมปุ่ม "ออกจากระบบ (Logout)" เล็กๆ แบบมินิมอลที่มุมขวาบนของหน้า Admin
  const isMatrixActive = pathname === "/admin";
  const isHistoryActive = pathname.startsWith("/admin/history");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Navbar Header (Monochrome) */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/admin"
              className="w-9 h-9 bg-white text-black font-bold flex items-center justify-center text-lg rounded-none hover:bg-neutral-200 transition"
              title="หน้าหลัก Admin"
            >
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <Link
                  href="/admin"
                  className="text-sm sm:text-base font-bold font-mono tracking-tight text-white uppercase hover:text-neutral-300 transition"
                >
                  SUT CENTRAL PRICE MATRIX
                </Link>
                {isDemoMode && (
                  <span className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-mono px-2 py-0.5 uppercase">
                    DEMO MODE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 font-mono hidden sm:block">
                SUT Student Council Budget Pre-Audit Admin Portal
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Navigation Tabs */}
            <nav className="flex items-center space-x-1">
              <Link
                href="/admin"
                className={`px-3 py-1.5 text-xs font-mono font-medium transition flex items-center space-x-1.5 border ${
                  isMatrixActive
                    ? "bg-white text-black border-white font-semibold"
                    : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">จัดการราคากลาง</span>
              </Link>
              <Link
                href="/admin/history"
                className={`px-3 py-1.5 text-xs font-mono font-medium transition flex items-center space-x-1.5 border ${
                  isHistoryActive
                    ? "bg-white text-black border-white font-semibold"
                    : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ประวัติการตรวจสอบ</span>
              </Link>
            </nav>

            <div className="h-6 w-px bg-neutral-800 hidden sm:block"></div>

            {/* Admin User info */}
            <div className="hidden md:flex flex-col items-end text-xs font-mono">
              <span className="text-neutral-500">ADMIN USER</span>
              <span className="text-white font-semibold truncate max-w-[180px]">
                {user.email || user.displayName || "Admin"}
              </span>
            </div>

            <div className="h-6 w-px bg-neutral-800 hidden md:block"></div>

            {/* ปุ่มออกจากระบบ (Logout) เล็กๆ แบบมินิมอลที่มุมขวาบน */}
            <button
              type="button"
              onClick={handleLogout}
              className="bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-mono py-2 px-3 border border-neutral-800 hover:border-neutral-700 transition flex items-center space-x-1.5 rounded-none group cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>ออกจากระบบ (Logout)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">{children}</div>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-800 py-6 text-xs text-neutral-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © {new Date().getFullYear()} SUT STUDENT COUNCIL — AUDIT & PRICE MATRIX PORTAL
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <Link href="/" className="hover:text-white transition">
              หน้าสแกน User
            </Link>
            <span>•</span>
            <Link href="/admin" className="hover:text-white transition">
              จัดการราคากลาง
            </Link>
            <span>•</span>
            <Link href="/admin/history" className="hover:text-white transition">
              ประวัติการตรวจสอบ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
