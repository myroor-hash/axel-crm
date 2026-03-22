"use client";

import { FormEvent, useMemo, useState } from "react";

type AdminUserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export function UserManager({
  initialUsers,
}: {
  initialUsers: AdminUserRow[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [users]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: AdminUserRow; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? "Unable to create the user.");
      }

      setUsers((prev) => [payload.user as AdminUserRow, ...prev]);
      setSuccessMessage(
        "User created. They can now sign in with that email and password, then set up 2FA."
      );
      setFullName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the user."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-semibold text-slate-900">Add User</h2>
          <p className="mt-1 text-sm text-slate-700">
            Create a CRM login for a trusted user. They will sign in with this
            password, then enroll phone-based 2FA on first access.
          </p>
        </div>

        <form className="mt-6 grid gap-5 md:grid-cols-3" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="Dan Example"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="dan@example.com"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Temporary Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              placeholder="At least 10 characters"
            />
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create User"}
            </button>

            {successMessage ? (
              <span className="text-sm font-medium text-emerald-700">
                {successMessage}
              </span>
            ) : null}

            {errorMessage ? (
              <span className="text-sm font-medium text-red-700">
                {errorMessage}
              </span>
            ) : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-semibold text-slate-900">Approved Users</h2>
          <p className="mt-1 text-sm text-slate-700">
            Admin is hidden from navigation. Standard users can access the rest
            of the CRM once they have signed in and completed 2FA.
          </p>
        </div>

        <div className="mt-6 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-800">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id} className="border-t border-slate-200">
                  <td className="p-3 text-slate-900">{user.full_name}</td>
                  <td className="p-3 text-slate-800">{user.email}</td>
                  <td className="p-3 text-slate-800">
                    {user.role === "admin" ? "Admin" : "User"}
                  </td>
                  <td className="p-3 text-slate-800">
                    {user.is_active ? "Active" : "Inactive"}
                  </td>
                  <td className="p-3 text-slate-800">
                    {new Date(user.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
