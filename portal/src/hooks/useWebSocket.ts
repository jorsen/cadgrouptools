'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketOptions {
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

export const useWebSocket = (url: string, options: WebSocketOptions = {}) => {
  const {
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnect = true,
    reconnectInterval = 5000,
    reconnectAttempts = 5,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);

  const connect = useCallback(() => {
    // Skip connection if URL is empty or invalid
    if (!url || url === '') {
      console.log('WebSocket URL not configured, skipping connection');
      return;
    }
    
    // Skip WebSocket in production if pointing to localhost (not configured)
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
    if (isProduction && url.includes('localhost')) {
      console.log('WebSocket URL points to localhost in production, skipping connection');
      return;
    }

    try {
      // Clean up existing connection
      if (ws.current) {
        ws.current.close();
      }

      // Create new WebSocket connection
      ws.current = new WebSocket(url);

      ws.current.onopen = (event) => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectCount.current = 0;
        if (onOpen) onOpen(event);
      };

      ws.current.onmessage = (event) => {
        setLastMessage(event);
        if (onMessage) onMessage(event);
      };

      ws.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        if (onError) onError(event);
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket closed');
        setIsConnected(false);
        if (onClose) onClose(event);

        // Attempt to reconnect if enabled
        if (reconnect && reconnectCount.current < reconnectAttempts) {
          reconnectCount.current++;
          console.log(`Attempting to reconnect... (${reconnectCount.current}/${reconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      
      // Attempt to reconnect on connection failure
      if (reconnect && reconnectCount.current < reconnectAttempts) {
        reconnectCount.current++;
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    }
  }, [url, onOpen, onMessage, onError, onClose, reconnect, reconnectInterval, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((data: string | ArrayBuffer | Blob) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(data);
      return true;
    }
    console.warn('WebSocket is not connected');
    return false;
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected && reconnect) {
        console.log('Tab became visible, attempting to reconnect...');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, reconnect, connect]);

  return {
    isConnected,
    sendMessage,
    lastMessage,
    disconnect,
    reconnect: connect,
  };
};