import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { UserPlus2 } from "lucide-react";

function RegisterPICPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name || !form.email || !form.password) {
      toast.error("All fields are required.");
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Create user in Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (authErr) throw authErr;

      const uid = authData.user?.id;
      if (!uid) throw new Error("Failed to get user ID after registration.");

      // 2️⃣ Store profile in Supabase profiles table
      const { error: profErr } = await supabase.from("profiles").insert({
        id: uid,
        display_name: form.name,
        email: form.email,
        username: form.email,
      });
      if (profErr) throw profErr;

      // 3️⃣ Store role in user_roles table
      const { error: roleErr } = await supabase.from("user_roles").insert({
        id: uid,
        role: form.role,
      });
      if (roleErr) throw roleErr;

      toast.success("New User registered successfully!");

      setTimeout(() => {
        navigate("/settings");
      }, 1200);

    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to register user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h1 className="text-xl font-bold mb-6 flex items-center gap-2">
            <UserPlus2 size={20} />
            Create User Account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Email (Username)</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="user">User</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Register New User"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default RegisterPICPage;
