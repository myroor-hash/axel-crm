"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminNavLink() {
  const [showAdminLink, setShowAdminLink] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function checkAdminAccess() {
      try {
        const response = await fetch("/api/admin/users", {
          method: "GET",
          credentials: "same-origin",
        });

        if (!ignore) {
          setShowAdminLink(response.ok);
        }
      } catch {
        if (!ignore) {
          setShowAdminLink(false);
        }
      }
    }

    void checkAdminAccess();

    return () => {
      ignore = true;
    };
  }, []);

  if (!showAdminLink) {
    return null;
  }

  return (
    <>
      <span className="text-slate-300">/</span>
      <Link
        href="/admin/users"
        className="transition hover:text-slate-900 hover:underline hover:underline-offset-4"
      >
        Admin
      </Link>
    </>
  );
}
