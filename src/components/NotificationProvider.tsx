import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Notification = {
  id: string;
  text: string;
  read: boolean;
  createdAt: number;
};

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (text: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

let seq = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idsRef = useRef(new Set<string>());

  const addNotification = useCallback((text: string) => {
    const id = `n-${Date.now()}-${++seq}`;
    idsRef.current.add(id);
    setNotifications((prev) => [
      { id, text, read: false, createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const dismiss = useCallback((id: string) => {
    idsRef.current.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    idsRef.current.clear();
    setNotifications([]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      dismiss,
      clearAll,
      markAllRead,
    }),
    [notifications, unreadCount, addNotification, dismiss, clearAll, markAllRead],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
