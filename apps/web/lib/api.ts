import type { Goal, User, Notification, Review, Template } from '../types';

const runtimeEnv = typeof window !== 'undefined' ? window.__ENV__ : undefined;
const baseUrl = runtimeEnv?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';

let accessToken: string | null = null;

function setAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    'Content-Type': 'application/json'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (res.status === 401 && retry) {
    const refreshed = await refresh();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const res = await request<{ accessToken: string; user: User; refreshExpiresAt: string }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password })
    },
    false
  );
  setAccessToken(res.accessToken);
  return res;
}

export async function refresh() {
  try {
    const res = await request<{ accessToken: string; user: User; refreshExpiresAt: string }>(
      '/auth/refresh',
      { method: 'POST' },
      false
    );
    setAccessToken(res.accessToken);
    return res;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function logout() {
  await request('/auth/logout', { method: 'POST' }, false);
  setAccessToken(null);
}

export async function getMe() {
  const res = await request<{ user: User } & Record<string, unknown>>('/users/me');
  return res.user;
}

export async function listUsers() {
  const res = await request<{ items: User[] }>('/users');
  return res.items;
}

export async function updateUser(id: number | string, data: Partial<User>) {
  const res = await request<{ user: User }>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
  return res.user;
}

export async function updateUserPassword(id: number | string, password: string) {
  await request(`/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password })
  });
}

export async function registerUser(data: Partial<User> & { password: string; role: string }) {
  const res = await request<{ user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.user;
}

export async function listNotifications() {
  const res = await request<{ items: Notification[] }>('/notifications');
  return res.items;
}

export async function listTemplates() {
  const res = await request<{ items: Template[] }>('/templates');
  return res.items;
}

export async function applyTemplate(userId: string, templateId?: number) {
  const res = await request<{ message: string; goalsCreated: number; totalGoals: number }>('/templates/apply', {
    method: 'POST',
    body: JSON.stringify({ userId, templateId: templateId ?? 1 })
  });
  return res;
}

export async function markNotificationRead(id: number | string) {
  const res = await request<{ notification: Notification }>(`/notifications/${id}/read`, {
    method: 'POST'
  });
  return res.notification;
}

export async function listGoals(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await request<{ items: Goal[] }>(`/goals${query}`);
  return res.items;
}

export async function createGoal(data: Partial<Goal> & { assignedToId: string }) {
  const res = await request<{ goal: Goal }>('/goals', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.goal;
}

export async function updateGoal(id: number | string, data: Partial<Goal>) {
  const res = await request<{ goal: Goal }>(`/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
  return res.goal;
}

export async function completeGoal(id: number | string, done: boolean) {
  const res = await request<{ goal: Goal }>(`/goals/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ done })
  });
  return res.goal;
}

export async function deleteGoal(id: number | string) {
  await request(`/goals/${id}`, { method: 'DELETE' });
}

export async function listReviews(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await request<{ items: Review[] }>(`/reviews${query}`);
  return res.items;
}

export async function createReview(data: Record<string, unknown>) {
  const res = await request<{ review: Review }>('/reviews', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.review;
}

export async function sendReviewReportEmail(data: {
  to: string[];
  subject: string;
  text: string;
  filename: string;
  contentBase64: string;
}) {
  await request('/reviews/email', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export const auth = {
  setAccessToken
};
