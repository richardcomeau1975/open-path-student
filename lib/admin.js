"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "./api";

const AdminContext = createContext({ isAdmin: false });

export function AdminProvider({ children }) {
  const { getToken, isLoaded } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    async function check() {
      try {
        const token = await getToken();
        const data = await apiFetch("/api/me", {}, token);
        setIsAdmin(!!data.is_admin);
      } catch (e) {
        // Not logged in or error — not admin
      }
    }
    check();
  }, [isLoaded, getToken]);

  return (
    <AdminContext.Provider value={{ isAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
