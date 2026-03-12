"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type OrgRole = "admin" | "editor" | "member";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  system_role: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface OrgMember {
  org_id: string;
  role: OrgRole;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  org: Organization | null;
  orgRole: OrgRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;   // role === 'admin'
  canEdit: boolean;   // role === 'admin' | 'editor'
  refreshAuth: () => Promise<void>;
  debugError: any;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState<any>(null); // NEW: Surface hard SQL errors

  // Persist the Supabase client inside useState so it isn't recreated on every re-render
  const [supabase] = useState(() => createClient());

  async function loadUserData(userId: string, token: string) {
    try {
      console.log("[AuthContext] loadUserData starting for userId:", userId);
      const withTimeout = (promise: any, ms: number) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("fetch timeout")), ms))
      ]);
      
      if (!token) {
        throw new Error("No active session token to fetch user data.");
      }

      const headers = {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${token}`
      };

      // Load profile via native fetch
      const profRes = await withTimeout(fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, { headers }), 5000) as Response;
      if (profRes.ok) {
        const profData = await profRes.json();
        if (profData && profData.length > 0) {
           setProfile(profData[0] as Profile);
        }
      } else {
        console.error("[AuthContext] Error loading profile:", await profRes.text());
      }

      // Load org membership via native fetch
      const memRes = await withTimeout(fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/org_members?user_id=eq.${userId}&select=org_id,role,organizations(id,name,slug)&limit=1`, { headers }), 5000) as Response;
      
      if (memRes.ok) {
        const memberDataList = await memRes.json();
        console.log("TEST========>", memberDataList)

        const memberData = memberDataList?.[0] || null;
        console.log("[AuthContext] memberData loaded:", memberData);

        if (memberData) {
          console.log("[AuthContext] Setting org role:", memberData.role);
          setOrgRole(memberData.role as OrgRole);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawOrg = (memberData as any).organizations;
          const orgInfo = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;
          
          console.log("[AuthContext] Parsed orgInfo:", orgInfo);

          if (orgInfo) {
            console.log("[AuthContext] Calling setOrg with:", { id: orgInfo.id, name: orgInfo.name, slug: orgInfo.slug });
            setOrg({
              id: orgInfo.id,
              name: orgInfo.name,
              slug: orgInfo.slug,
            });
          } else {
            console.warn("[AuthContext] memberData exists but orgInfo is falsy!");
          }
        } else {
          console.log("[AuthContext] No memberData found. Setting org to null.");
          setOrg(null);
          setOrgRole(null);
        }
      } else {
        const errText = await memRes.text();
        console.error("[AuthContext] Error loading org membership:", errText);
        setDebugError({ step: 'org_members', err: errText });
      }
    } catch (err) {
      console.error("[AuthContext] Failed to load user data (caught exception):", err);
      setDebugError({ step: 'catch_block', err: String(err) });
    } finally {
      console.log("[AuthContext] loadUserData finished");
    }
  }

  async function refreshAuth() {
    console.log("[AuthContext] refreshAuth called");
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    console.log("CURRENT USER",currentUser)
    if (currentUser) {
      const { data } = await supabase.auth.getSession();
      setUser(currentUser);
      if (data?.session) {
         await loadUserData(currentUser.id, data.session.access_token);
      }
    }
  }

  useEffect(() => {
    console.log("[AuthContext] Initializing auth check...");
    let isMounted = true;

    // Safety fallback: if Supabase takes more than 3 seconds to respond, force UI unblock.
    const fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("[AuthContext] Safety timeout triggered. Forcing loading to false.");
        setLoading(false);
      }
    }, 3000);

    supabase.auth.getUser()
      .then(async ({ data: { user: currentUser }, error }) => {
        if (!isMounted) return;
        console.log("[AuthContext] getUser completed. User:", currentUser?.id, "Error:", error);
        setUser(currentUser);
        if (currentUser) {
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
             await loadUserData(currentUser.id, data.session.access_token);
          }
        }
      })
      .catch(err => {
        if (isMounted) console.error("[AuthContext] Initial auth fetch failed completely:", err);
      })
      .finally(() => {
        if (isMounted) {
          console.log("[AuthContext] Setting loading to false in finally block");
          setLoading(false);
          clearTimeout(fallbackTimeout);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      console.log("[AuthContext] Auth state changed:", event, "User:", session?.user?.id);
      
      if (session?.user) {
        if (event !== "INITIAL_SESSION") {
            setUser(session.user);
            await loadUserData(session.user.id, session.access_token);
            setLoading(false); // Unblock immediately if state fired
        }
      } else if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setProfile(null);
        setOrg(null);
        setOrgRole(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isAdmin = orgRole === "admin";
  const canEdit = orgRole === "admin" || orgRole === "editor";

  return (
    <AuthContext.Provider value={{ user, profile, org, orgRole, loading, signOut, isAdmin, canEdit, refreshAuth, debugError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
