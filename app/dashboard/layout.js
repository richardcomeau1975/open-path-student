"use client";

import Header from "../../components/Header";

export default function DashboardLayout({ children }) {
  return (
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
  );
}
