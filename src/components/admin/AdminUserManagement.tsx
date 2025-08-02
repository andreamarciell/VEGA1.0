// src/components/admin/AdminUserManagement.tsx
import { useState } from 'react';
import { createUserRemote } from '@/lib/adminAuth';

export default function AdminUserManagement() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [status, setStatus] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      await createUserRemote({ username: form.username, password: form.password });
      setStatus('Utente creato con successo!');
      setForm({ username: '', password: '' });
    } catch (err: any) {
      setStatus(err.message || 'Errore inaspettato');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Crea nuovo utente</h2>
      <form className="space-y-2" onSubmit={handleSubmit}>
        <input
          name="username"
          value={form.username}
          onChange={handleChange}
          placeholder="Username"
          className="border p-2 rounded w-full"
          required
        />
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password"
          className="border p-2 rounded w-full"
          required
        />
        <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">
          Crea utente
        </button>
      </form>
      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}