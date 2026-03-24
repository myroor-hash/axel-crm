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

type EditableUser = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
};

export function UserManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [users]
  );

  function resetMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    resetMessages();

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

  function startEditing(user: AdminUserRow) {
    resetMessages();
    setEditingUser({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      isActive: user.is_active,
    });
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;

    setIsSavingEdit(true);
    resetMessages();

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingUser),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: AdminUserRow; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? "Unable to update the user.");
      }

      setUsers((prev) =>
        prev.map((user) => (user.id === payload.user?.id ? payload.user : user))
      );
      setSuccessMessage("User details updated.");
      setEditingUser(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update the user."
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(user: AdminUserRow) {
    const confirmed = window.confirm(
      `Delete ${user.full_name}? This will remove their CRM access and auth account.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    resetMessages();

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: user.id }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to delete the user.");
      }

      setUsers((prev) => prev.filter((row) => row.id !== user.id));
      setSuccessMessage("User deleted.");
      if (editingUser?.id === user.id) {
        setEditingUser(null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete the user."
      );
    } finally {
      setDeletingUserId(null);
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

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-semibold text-slate-900">Approved Users</h2>
            <p className="mt-1 text-sm text-slate-700">
              Edit user details, deactivate accounts, or remove a user entirely.
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
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const isAdmin = user.role === "admin";
                  const isCurrentUser = user.id === currentUserId;

                  return (
                    <tr key={user.id} className="border-t border-slate-200">
                      <td className="p-3 text-slate-900">
                        {user.full_name}
                        {isCurrentUser ? (
                          <span className="ml-2 text-xs font-medium text-slate-500">
                            (You)
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-slate-800">{user.email}</td>
                      <td className="p-3 text-slate-800">
                        {isAdmin ? "Admin" : "User"}
                      </td>
                      <td className="p-3 text-slate-800">
                        {user.is_active ? "Active" : "Inactive"}
                      </td>
                      <td className="p-3 text-slate-800">
                        {new Date(user.created_at).toLocaleDateString("en-GB")}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(user)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-900 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          {!isAdmin ? (
                            <button
                              type="button"
                              disabled={deletingUserId === user.id}
                              onClick={() => handleDelete(user)}
                              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingUserId === user.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-semibold text-slate-900">
              {editingUser ? "Edit User" : "Select a User"}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {editingUser
                ? "Update user details here, including your own account."
                : "Choose a user from the table to edit their details."}
            </p>
          </div>

          {editingUser ? (
            <form className="mt-6 space-y-4" onSubmit={handleSaveEdit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editingUser.fullName}
                  onChange={(event) =>
                    setEditingUser((prev) =>
                      prev
                        ? { ...prev, fullName: event.target.value }
                        : prev
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(event) =>
                    setEditingUser((prev) =>
                      prev ? { ...prev, email: event.target.value } : prev
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={editingUser.isActive}
                  onChange={(event) =>
                    setEditingUser((prev) =>
                      prev
                        ? { ...prev, isActive: event.target.checked }
                        : prev
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                Active user
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
              Choose a user from the table to edit their details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
