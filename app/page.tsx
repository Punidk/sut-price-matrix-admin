"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/admin");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-xs">
      <div className="flex items-center space-x-3">
        <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
        <span>REDIRECTING TO PORTAL...</span>
      </div>
    </div>
  );
}
