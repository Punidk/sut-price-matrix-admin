"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

export interface DemoUser {
  email: string | null;
  uid: string;
  isDemo?: boolean;
}

interface AuthContextType {
  user: User | DemoUser | null;
  loading: boolean;
  isDemoMode: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemoMode: false,
  login: async () => {},
  logout: async () => {},
});

const DEMO_USER_KEY = "sut_admin_demo_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | DemoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = Router();
  const pathname = usePathname();

  function Router() {
    return useRouter();
  }

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Demo mode session check from localStorage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(DEMO_USER_KEY);
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch {
            setUser(null);
          }
        }
      }
      setLoading(false);
    }
  }, []);

  // Route protection rules
  useEffect(() => {
    if (loading) return;

    if (!user && pathname.startsWith("/admin")) {
      router.push("/login");
    } else if (user && pathname === "/login") {
      router.push("/admin");
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, pass: string) => {
    if (isFirebaseConfigured && auth) {
      await signInWithEmailAndPassword(auth, email, pass);
    } else {
      // Demo fallback login simulation
      if (email.trim() && pass.trim()) {
        const demoUser: DemoUser = {
          email: email.trim(),
          uid: "demo-user-sut-01",
          isDemo: true,
        };
        localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
        setUser(demoUser);
      } else {
        throw new Error("Please fill in both email and password.");
      }
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
    } else {
      localStorage.removeItem(DEMO_USER_KEY);
      setUser(null);
    }
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode: !isFirebaseConfigured,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
