import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import type { User, Template, Notification, Goal, Review } from '../types';
import * as api from '../lib/api';

type Theme = 'light' | 'dark';

interface AppContextType {
  currentUser: User | null;
  employees: User[];
  notifications: Notification[];
  templates: Template[];
  theme: Theme;
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  refreshEmployees: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  updateUserPassword: (userId: number | string, newPassword: string) => Promise<void>;
  updateEmployee: (userId: number | string, data: Partial<User>) => Promise<void>;
  registerEmployee: (data: Partial<User> & { password: string }) => Promise<void>;
  deleteEmployee: (userId: number | string) => Promise<void>;
  createGoal: (data: Partial<Goal> & { assignedToId: string }) => Promise<Goal>;
  updateGoal: (goalId: number | string, data: Partial<Goal>) => Promise<Goal>;
  deleteGoal: (goalId: number | string) => Promise<void>;
  completeGoal: (goalId: number | string, done: boolean) => Promise<Goal>;
  createReview: (payload: Record<string, unknown>) => Promise<Review>;
  markNotificationRead: (id: number | string) => Promise<void>;
  loading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

const getInitialTheme = (): Theme => {
  try {
    const storedTheme = window.localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [loading, setLoading] = useState(true);
  const currentUserRef = useRef<User | null>(null);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore theme persistence errors
    }
  }, [theme]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const refreshNotifications = useCallback(async (user?: User | null) => {
    const target = user ?? currentUserRef.current;
    if (!target) return;
    const data = await api.listNotifications();
    setNotifications(data);
  }, []);

  const refreshTemplates = useCallback(async () => {
    const data = await api.listTemplates();
    setTemplates(data);
  }, []);

  const refreshEmployees = useCallback(async (user?: User | null) => {
    const target = user ?? currentUserRef.current;
    if (!target || (target.role !== 'manager' && target.role !== 'admin')) {
      setEmployees([]);
      return;
    }
    const data = await api.listUsers();
    setEmployees(data.filter((u) => u.isActive !== false));
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const me = await api.getMe();
    setCurrentUser(me);
    return me;
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    const refreshed = await api.refresh();
    if (refreshed) {
      const me = await refreshCurrentUser();
      await Promise.all([refreshEmployees(me), refreshNotifications(me), refreshTemplates()]);
    } else {
      setCurrentUser(null);
      setEmployees([]);
      setNotifications([]);
      setTemplates([]);
    }
    setLoading(false);
  }, [refreshCurrentUser, refreshEmployees, refreshNotifications, refreshTemplates]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      await api.login(email, password);
      const me = await refreshCurrentUser();
      await Promise.all([refreshEmployees(me), refreshNotifications(me), refreshTemplates()]);
      setLoading(false);
    },
    [refreshCurrentUser, refreshEmployees, refreshNotifications, refreshTemplates]
  );

  const logout = useCallback(async () => {
    await api.logout();
    setCurrentUser(null);
    setEmployees([]);
    setNotifications([]);
    setTemplates([]);
  }, []);

  const updateUserPassword = useCallback(async (userId: number | string, newPassword: string) => {
    await api.updateUserPassword(userId, newPassword);
  }, []);

  const updateEmployee = useCallback(
    async (userId: number | string, data: Partial<User>) => {
      const updated = await api.updateUser(userId, data);
      setEmployees((prev) => prev.map((e) => (String(e.id) === String(updated.id) ? { ...e, ...updated } : e)));
      if (currentUser && String(currentUser.id) === String(updated.id)) {
        setCurrentUser((prev) => (prev ? { ...prev, ...updated } : prev));
      }
    },
    [currentUser]
  );

  const registerEmployee = useCallback(
    async (data: Partial<User> & { password: string }) => {
      const created = await api.registerUser(data as any);
      await refreshEmployees();
      return created;
    },
    [refreshEmployees]
  );

  const deleteEmployee = useCallback(async (userId: number | string) => {
    await api.updateUser(userId, { isActive: false });
    setEmployees((prev) => prev.filter((e) => String(e.id) !== String(userId)));
    if (currentUser && String(currentUser.id) === String(userId)) {
      setCurrentUser(null);
    }
  }, [currentUser]);

  const createGoal = useCallback(async (data: Partial<Goal> & { assignedToId: string }) => {
    const goal = await api.createGoal(data);
    setEmployees((prev) =>
      prev.map((e) => (String(e.id) === String(goal.assignedToId) ? { ...e, goals: [...e.goals, goal] } : e))
    );
    if (currentUser && String(currentUser.id) === String(goal.assignedToId)) {
      setCurrentUser({ ...currentUser, goals: [...currentUser.goals, goal] });
    }
    return goal;
  }, [currentUser]);

  const updateGoal = useCallback(async (goalId: number | string, data: Partial<Goal>) => {
    const goal = await api.updateGoal(goalId, data);
    setEmployees((prev) =>
      prev.map((e) =>
        String(e.id) === String(goal.assignedToId)
          ? { ...e, goals: e.goals.map((g) => (String(g.id) === String(goal.id) ? goal : g)) }
          : e
      )
    );
    if (currentUser && String(currentUser.id) === String(goal.assignedToId)) {
      setCurrentUser({
        ...currentUser,
        goals: currentUser.goals.map((g) => (String(g.id) === String(goal.id) ? goal : g))
      });
    }
    return goal;
  }, [currentUser]);

  const deleteGoal = useCallback(async (goalId: number | string) => {
    await api.deleteGoal(goalId);
    setEmployees((prev) =>
      prev.map((e) => ({ ...e, goals: e.goals.filter((g) => String(g.id) !== String(goalId)) }))
    );
    if (currentUser) {
      setCurrentUser({ ...currentUser, goals: currentUser.goals.filter((g) => String(g.id) !== String(goalId)) });
    }
  }, [currentUser]);

  const completeGoal = useCallback(async (goalId: number | string, done: boolean) => {
    const goal = await api.completeGoal(goalId, done);
    setEmployees((prev) =>
      prev.map((e) =>
        String(e.id) === String(goal.assignedToId)
          ? { ...e, goals: e.goals.map((g) => (String(g.id) === String(goal.id) ? goal : g)) }
          : e
      )
    );
    if (currentUser && String(currentUser.id) === String(goal.assignedToId)) {
      setCurrentUser({
        ...currentUser,
        goals: currentUser.goals.map((g) => (String(g.id) === String(goal.id) ? goal : g))
      });
    }
    return goal;
  }, [currentUser]);

  const createReview = useCallback(async (payload: Record<string, unknown>) => {
    const review = await api.createReview(payload);
    if ((payload.revieweeId as string) && currentUser) {
      setEmployees((prev) =>
        prev.map((e) =>
          String(e.id) === String(payload.revieweeId)
            ? { ...e, reviews: [...(e.reviews || []), review] }
            : e
        )
      );
    }
    return review;
  }, [currentUser]);

  const markNotificationRead = useCallback(async (id: number | string) => {
    const updated = await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      employees,
      notifications,
      templates,
      theme,
      toggleTheme,
      login,
      logout,
      refreshCurrentUser,
      refreshEmployees,
      refreshNotifications,
      updateUserPassword,
      updateEmployee,
      registerEmployee,
      deleteEmployee,
      createGoal,
      updateGoal,
      deleteGoal,
      completeGoal,
      createReview,
      markNotificationRead,
      loading
    }),
    [
      currentUser,
      employees,
      notifications,
      templates,
      theme,
      toggleTheme,
      login,
      logout,
      refreshCurrentUser,
      refreshEmployees,
      refreshNotifications,
      updateUserPassword,
      updateEmployee,
      registerEmployee,
      deleteEmployee,
      createGoal,
      updateGoal,
      deleteGoal,
      completeGoal,
      createReview,
      markNotificationRead,
      loading
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
};
