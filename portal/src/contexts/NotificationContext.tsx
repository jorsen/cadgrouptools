'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';
import type { Notification } from '@/types/notification';
import { useWebSocket } from '@/hooks/useWebSocket';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  fetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Initialize audio for notification sound
  useEffect(() => {
    // Only try to load audio in browser environment
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        
        // Handle load errors gracefully
        audio.addEventListener('error', () => {
          console.warn('Notification sound file not found - notifications will be silent');
          audioRef.current = null;
        });
        
        audio.addEventListener('canplaythrough', () => {
          audioRef.current = audio;
        });
        
        // Try to preload
        audio.load();
      } catch (error) {
        console.warn('Notification sound not available:', error);
        audioRef.current = null;
      }
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Ignore errors if audio play is blocked
      });
    }
  }, []);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      // Use mock data for development
      setNotifications(getMockNotifications());
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket handler for real-time notifications
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'notification') {
        const newNotification: Notification = {
          ...data.payload,
          timestamp: new Date(),
          read: false,
        };
        
        setNotifications(prev => [newNotification, ...prev]);
        playNotificationSound();
        
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification(newNotification.title, {
            body: newNotification.message,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [200, 100, 200],
          });
        }
        
        // Show in-app notification
        message.info({
          content: (
            <div>
              <strong>{newNotification.title}</strong>
              <div>{newNotification.message}</div>
            </div>
          ),
          duration: 4,
        });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [playNotificationSound]);

  // Initialize WebSocket connection only if URL is configured
  // Skip WebSocket in production if not configured to avoid console errors
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const shouldConnectWs = Boolean(wsUrl && wsUrl !== 'disabled');
  
  useWebSocket(
    shouldConnectWs && wsUrl ? wsUrl : '',
    {
      onMessage: handleWebSocketMessage,
      reconnect: shouldConnectWs,
      reconnectInterval: 5000,
    }
  );

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Optimistic update for development
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Optimistic update for development
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  // Delete a notification
  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        message.success('Notification deleted');
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Optimistic update for development
      setNotifications(prev => prev.filter(n => n.id !== id));
      message.success('Notification deleted');
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    try {
      const response = await fetch('/api/notifications/clear', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      // Optimistic update for development
      setNotifications([]);
    }
  };

  // Add a new notification (for testing/development)
  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    playNotificationSound();
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    addNotification,
    fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Mock notifications for development
function getMockNotifications(): Notification[] {
  return [
    {
      id: '1',
      type: 'proposal',
      title: 'Proposal Accepted',
      message: 'Your proposal for "Web Development Project" has been accepted by Tech Solutions Inc.',
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      read: false,
      priority: 'high',
      actionUrl: '/proposals/123',
      sender: {
        name: 'John Smith',
        role: 'Client',
      },
    },
    {
      id: '2',
      type: 'user',
      title: 'New Team Member',
      message: 'Sarah Johnson has joined your team as a Senior Developer',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      read: false,
      actionUrl: '/team/sarah-johnson',
      sender: {
        name: 'HR Department',
      },
    },
    {
      id: '3',
      type: 'payment',
      title: 'Payment Received',
      message: 'Payment of $15,000 received from Client ABC for Invoice #INV-2024-045',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: true,
      priority: 'medium',
      actionUrl: '/accounting/transactions',
      metadata: {
        amount: 15000,
      },
    },
    {
      id: '4',
      type: 'document',
      title: 'Document Shared',
      message: 'Mike Davis shared "Q4 Financial Report.pdf" with you',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      read: true,
      actionUrl: '/documents/q4-report',
      sender: {
        name: 'Mike Davis',
        role: 'Accountant',
      },
    },
    {
      id: '5',
      type: 'task',
      title: 'Task Deadline Approaching',
      message: 'Task "Review Q1 Proposals" is due tomorrow at 5:00 PM',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      read: false,
      priority: 'urgent',
      actionUrl: '/tasks/review-q1',
    },
    {
      id: '6',
      type: 'system',
      title: 'System Maintenance',
      message: 'Scheduled maintenance will occur on Sunday, Jan 20 from 2:00 AM to 4:00 AM EST',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      read: true,
    },
  ];
}