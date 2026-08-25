"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, ShieldCheck, Database, Layers } from "lucide-react";

export default function Navbar() {
  const { user, logout, isDemoMode } = useAuth();

  return (
    <header className="bg-neutral-950 border-b border-neutral-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & System Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white text-black font-bold flex items-center justify-center text-lg rounded-none shadow-sm">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold font-mono tracking-tight text-white uppercase">
                  SUT Central Price Matrix
                </h1>
                {isDemoMode && (
                  <span className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider">
                    DEMO MODE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 font-mono hidden sm:block">
                Student Council Budget Pre-Audit System
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex flex-col items-end text-xs font-mono">
              <span className="text-neutral-400">AUTHENTICATED USER</span>
              <span className="text-white font-semibold truncate max-w-[200px]">
                {user?.email || "Admin User"}
              </span>
            </div>

            <div className="h-6 w-px bg-neutral-800 hidden md:block"></div>

            <button
              onClick={logout}
              className="bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-mono py-2 px-3.5 border border-neutral-700 hover:border-neutral-500 transition flex items-center space-x-2 rounded-none group"
              title="Sign out of system"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>LOGOUT</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
