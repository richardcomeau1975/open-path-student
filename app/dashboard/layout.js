"use client";

import Header from "../../components/Header";
import { AdminProvider } from "../../lib/admin";

export default function DashboardLayout({ children }) {
  return (
    <AdminProvider>
      <div>
        <Header />
        <main
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "32px 24px",
          }}
        >
          {children}
        </main>
      </div>
    </AdminProvider>
  );
}
