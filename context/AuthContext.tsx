"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import { isAllowedAdminEmail, UNAUTHORIZED_ADMIN_MESSAGE } from "@/lib/admin-whitelist";

export interface DemoUser {
  email: string | null;
  displayName?: string | null;
  uid: string;
  isDemo?: boolean;
}

interface AuthContextType {
  user: User | DemoUser | null;
  loading: boolean;
  isDemoMode: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemoMode: false,
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
});

const DEMO_USER_KEY = "sut_admin_demo_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | DemoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const firebaseAuth = auth;
    if (isFirebaseConfigured && firebaseAuth) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
        if (currentUser && !isAllowedAdminEmail(currentUser.email)) {
          await firebaseSignOut(firebaseAuth);
          setUser(null);
          setLoading(false);
          return;
        }
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
            const parsed = JSON.parse(stored);
            if (isAllowedAdminEmail(parsed.email)) {
              setUser(parsed);
            } else {
              localStorage.removeItem(DEMO_USER_KEY);
              setUser(null);
            }
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

    if (!user && pathname.startsWith("/admin") && pathname !== "/admin/login") {
      router.push("/admin/login");
    } else if (user && isAllowedAdminEmail(user.email) && (pathname === "/login" || pathname === "/admin/login")) {
      router.push("/admin/history");
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, pass: string) => {
    if (!isAllowedAdminEmail(email)) {
      throw new Error(UNAUTHORIZED_ADMIN_MESSAGE);
    }

    if (isFirebaseConfigured && auth) {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      if (!isAllowedAdminEmail(cred.user.email)) {
        await firebaseSignOut(auth);
        setUser(null);
        throw new Error(UNAUTHORIZED_ADMIN_MESSAGE);
      }
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

  const loginWithGoogle = async () => {
    if (isFirebaseConfigured && auth) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      if (result.user && !isAllowedAdminEmail(result.user.email)) {
        await firebaseSignOut(auth);
        setUser(null);
        throw new Error(UNAUTHORIZED_ADMIN_MESSAGE);
      }
    } else {
      const demoUser: DemoUser = {
        email: "advice39za@gmail.com",
        displayName: "SUT Admin (advice39za)",
        uid: "demo-google-admin-01",
        isDemo: true,
      };
      if (!isAllowedAdminEmail(demoUser.email)) {
        throw new Error(UNAUTHORIZED_ADMIN_MESSAGE);
      }
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
      setUser(demoUser);
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      await firebaseSignOut(auth);
    } else {
      localStorage.removeItem(DEMO_USER_KEY);
      setUser(null);
    }
    router.push("/admin/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode: !isFirebaseConfigured,
        login,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
