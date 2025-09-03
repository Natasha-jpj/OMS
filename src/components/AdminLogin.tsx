'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data?.admin?._id) {
        setError(data?.error || 'Invalid credentials');
        setSubmitting(false);
        return;
      }

      // ✅ Save for client-side fetch headers
      localStorage.setItem(
        'employee',
        JSON.stringify({ id: data.admin._id, name: data.admin.name ?? 'Admin' })
      );

      // (optional) cookie so server routes can also read it
      document.cookie = `employeeId=${data.admin._id}; path=/; SameSite=Lax`;

      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="username">Admin Login</label>
      <input
        id="username"
        name="username"
        autoComplete="username"
        placeholder="Admin username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        disabled={submitting}
        required
      />

      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        required
      />

      <button type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Login'}
      </button>

      {error && (
        <div style={{ marginTop: 12, color: '#f87171', fontWeight: 600 }}>
          {error}
        </div>
      )}
    </form>
  );
}
