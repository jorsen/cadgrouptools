import { io, Socket } from 'socket.io-client';

class ActivityWebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(userId?: string) {
    if (this.socket?.connected) {
      return;
    }

    // Initialize socket connection
    // In production, use the same origin. In development, use localhost
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 
                  (typeof window !== 'undefined' ? window.location.origin : '');
    
    // Skip connection if URL is not set or if it points to localhost in production
    if (!wsUrl || wsUrl === '') {
      console.log('WebSocket URL not configured, skipping connection');
      return;
    }
    
    // Skip WebSocket in production if pointing to localhost (not configured)
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
    if (isProduction && wsUrl.includes('localhost')) {
      console.log('WebSocket URL points to localhost in production, skipping connection');
      return;
    }
    
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      query: { userId },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      // Additional options for production
      ...(process.env.NODE_ENV === 'production' && {
        path: '/socket.io/',
        secure: true,
        rejectUnauthorized: false
      })
    });

    // Set up event listeners
    this.socket.on('connect', () => {
      console.log('Connected to activity websocket');
      this.reconnectAttempts = 0;
      
      // Send authentication event if userId is provided
      if (userId) {
        this.socket?.emit('authenticate', { userId });
      }
      
      this.emit('connected', { userId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from activity websocket:', reason);
      this.emit('disconnected', { reason });
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error });
    });

    // Listen for real-time activity updates
    this.socket.on('activity:new', (data) => {
      this.emit('activity:new', data);
    });

    this.socket.on('activity:stats', (data) => {
      this.emit('activity:stats', data);
    });

    this.socket.on('user:online', (data) => {
      this.emit('user:online', data);
    });

    this.socket.on('user:offline', (data) => {
      this.emit('user:offline', data);
    });

    // Reconnection logic
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`Attempting to reconnect (${attemptNumber}/${this.maxReconnectAttempts})`);
    });

    this.socket.on('reconnect', () => {
      console.log('Successfully reconnected to activity websocket');
      this.emit('reconnected', { attempts: this.reconnectAttempts });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to activity websocket');
      this.emit('reconnect_failed', {});
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Subscribe to activity updates for specific filters
  subscribeToActivities(filters?: {
    userId?: string;
    resourceType?: string;
    actionType?: string;
  }) {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected. Cannot subscribe to activities.');
      return;
    }

    this.socket.emit('subscribe:activities', filters);
  }

  // Unsubscribe from activity updates
  unsubscribeFromActivities() {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('unsubscribe:activities');
  }

  // Subscribe to user presence updates
  subscribeToUserPresence() {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected. Cannot subscribe to user presence.');
      return;
    }

    this.socket.emit('subscribe:presence');
  }

  // Event emitter methods
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Send custom events
  sendEvent(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected. Cannot send event.');
      return;
    }

    this.socket.emit(event, data);
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket instance (for advanced usage)
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const activityWebSocket = new ActivityWebSocketService();

// React hook for using the WebSocket service
import { useEffect, useState } from 'react';

export function useActivityWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [latestActivity, setLatestActivity] = useState<any>(null);
  const [activityStats, setActivityStats] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    // Connect to WebSocket
    activityWebSocket.connect();

    // Set up event listeners
    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);
    const handleNewActivity = (data: any) => setLatestActivity(data);
    const handleStats = (data: any) => setActivityStats(data);
    const handleUserOnline = (data: any) => {
      setOnlineUsers(prev => [...new Set([...prev, data.userId])]);
    };
    const handleUserOffline = (data: any) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    };

    activityWebSocket.on('connected', handleConnected);
    activityWebSocket.on('disconnected', handleDisconnected);
    activityWebSocket.on('activity:new', handleNewActivity);
    activityWebSocket.on('activity:stats', handleStats);
    activityWebSocket.on('user:online', handleUserOnline);
    activityWebSocket.on('user:offline', handleUserOffline);

    // Subscribe to updates
    activityWebSocket.subscribeToActivities();
    activityWebSocket.subscribeToUserPresence();

    // Cleanup
    return () => {
      activityWebSocket.off('connected', handleConnected);
      activityWebSocket.off('disconnected', handleDisconnected);
      activityWebSocket.off('activity:new', handleNewActivity);
      activityWebSocket.off('activity:stats', handleStats);
      activityWebSocket.off('user:online', handleUserOnline);
      activityWebSocket.off('user:offline', handleUserOffline);
      activityWebSocket.unsubscribeFromActivities();
    };
  }, []);

  return {
    isConnected,
    latestActivity,
    activityStats,
    onlineUsers,
    subscribeToActivities: activityWebSocket.subscribeToActivities.bind(activityWebSocket),
    unsubscribeFromActivities: activityWebSocket.unsubscribeFromActivities.bind(activityWebSocket),
  };
}