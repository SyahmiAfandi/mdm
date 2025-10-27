import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';

// ⬇️ from your firebaseClient (as provided earlier)
import {
  loginWithUsername,
  logout,
  buildPermissionSnapshot,
  persistPermissionSnapshot,
} from '../firebaseClient';

const PERM_STORAGE_KEY = 'ff.permissions';
const ROLE_STORAGE_KEY = 'ff.role';

function LoginPage() {
  const [username, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [expiredToast, setExpiredToast] = useState('');

  const navigate = useNavigate();
  const { setRole, setUser } = useUser();

  const clearLocalPerms = () => {
    try {
      localStorage.removeItem(PERM_STORAGE_KEY);
      localStorage.removeItem(ROLE_STORAGE_KEY);
    } catch {}
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setExpiredToast('');

    try {
      const result = await loginWithUsername(username, password);
      const { role, profile, license, licenseValid, permissions } = result;
      const resolvedRole = role || 'viewer';

      // License check (and show the expiry date if available)
      if (!licenseValid) {
        await logout();
        setLoading(false);

        let expText = 'N/A';
        try {
          const d =
            (license && license.validUntil && license.validUntil.toDate && license.validUntil.toDate()) ||
            null;
          if (d) expText = d.toISOString().slice(0, 10);
        } catch {}

        setExpiredToast(`Your account has expired on ${expText}!`);
        setTimeout(() => setExpiredToast(''), 1500);
        clearLocalPerms();
        return;
      }

      // Save user context
      setRole(resolvedRole);
      setUser({
        name: profile?.name || profile?.username || username,
        email: profile?.email || '',
      });

      // Persist username (optional)
      localStorage.setItem('username', profile?.name || profile?.username || username);
      localStorage.setItem(ROLE_STORAGE_KEY, resolvedRole);

      // 🔐 Build + store permission snapshot (from Firestore rolePermissions or fallback)
      const permSnapshot = buildPermissionSnapshot(resolvedRole, permissions);
      // write to localStorage so Sidebar can read instantly (no flicker)
      persistPermissionSnapshot(resolvedRole, permSnapshot);

      setLoading(false);
      setSuccess(true);
      setShowToast(true);

      // Navigate after a short success animation
      setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => navigate('/'), 400);
      }, 1200);
    } catch (e) {
      setLoading(false);
      setError(e?.message || 'Invalid credentials');
      clearLocalPerms();
    }
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-100 px-4 sm:px-6 lg:px-8">
        <style>{`
          @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
          @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
          @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes scale-in { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
          @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
          .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
          .animate-fade-out { animation: fade-out 0.8s ease-in forwards; }
          .animate-slide-down { animation: slide-down 0.5s ease-out forwards; }
          .animate-slide-up { animation: slide-up 0.5s ease-out 0.2s forwards; }
          .animate-scale-in { animation: scale-in 0.4s ease-out forwards; }
          .animate-fade-in-fast { animation: fade-in-fast 0.3s ease-in-out forwards; }
        `}</style>

        <div
          className={`bg-white shadow-2xl rounded-xl p-6 sm:p-8 w-full max-w-md transform transition duration-500 hover:scale-[1.02] mt-[-40px] sm:mt-0 ${
            fadeOut ? 'animate-fade-out' : 'animate-fade-in'
          }`}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-blue-700 mb-4 sm:mb-6 animate-slide-down">
            Welcome Back
          </h2>
          <p className="text-center text-sm text-gray-500 mb-4 sm:mb-6 animate-slide-up">
            Please sign in to access the dashboard
          </p>

          <input
            type="text"
            placeholder="User Name"
            className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={username}
            onChange={(e) => setUserName(e.target.value)}
            disabled={loading || success}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || success}
            autoComplete="current-password"
          />

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all duration-300 disabled:opacity-50 flex justify-center items-center"
            disabled={loading || success}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : success ? (
              <CheckCircle className="text-white animate-scale-in" size={24} />
            ) : (
              'Login'
            )}
          </button>

          {error && (
            <p className="text-red-600 mt-4 text-center animate-pulse text-sm">
              {error}
            </p>
          )}
        </div>

        {showToast && (
          <div className="fixed top-5 right-5 bg-green-600 text-white px-4 py-2 rounded shadow-lg animate-fade-in-fast">
            🎉 Welcome! You have successfully logged in.
          </div>
        )}

        {expiredToast && (
          <div className="fixed top-5 right-5 bg-red-600 text-white px-4 py-2 rounded shadow-lg animate-fade-in-fast">
            ❌ {expiredToast}
          </div>
        )}
      </div>
    </>
  );
}

export default LoginPage;
