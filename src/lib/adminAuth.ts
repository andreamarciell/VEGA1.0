// src/lib/adminAuth.ts
export async function createUserRemote(payload: {
  username?: string;
  name?: string;
  email?: string;
  password: string;
}) {
  // Trim fields to avoid accidental whitespace
  const body = {
    username: payload.username?.trim(),
    name: payload.name?.trim(),
    email: payload.email?.trim(),
    password: payload.password.trim(),
  };

  const res = await fetch('/.netlify/functions/createUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Unknown error creating user');
  }

  return res.json();
}