// WebSocket hook for real-time canvas synchronization
// Added for backend data sending logic

import { useEffect, useRef, useCallback } from 'react';
import type { Shape } from '../types';

const WS_BASE_URL = 'ws://localhost:8000'; // Adjust to your backend WebSocket URL

export interface WebSocketMessage {
  type: 'update' | 'clear' | 'undo' | 'shapes';
  data?: any;
  userId?: string; // To avoid echoing own messages
}

export const useWebSocket = (
  boardId: string,
  onShapesUpdate: (shapes: Shape[]) => void,
  currentShapes: Shape[],
  userId: string = 'user1' // For demo, generate unique ID in production
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      wsRef.current = new WebSocket(`${WS_BASE_URL}/ws/canvas/${boardId}/`);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Ignore own messages
          if (message.userId === userId) return;

          switch (message.type) {
            case 'update':
            case 'shapes':
              if (message.data && message.data.shapes) {
                onShapesUpdate(message.data.shapes);
              }
              break;
            case 'clear':
              onShapesUpdate([]);
              break;
            case 'undo':
              // For undo, we might need to receive the previous state
              if (message.data && message.data.shapes) {
                onShapesUpdate(message.data.shapes);
              }
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`);
            connect();
          }, 2000 * reconnectAttempts.current); // Exponential backoff
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [boardId, onShapesUpdate, userId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...message, userId }));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, [userId]);

  // Send shapes update
  const sendShapesUpdate = useCallback((shapes: Shape[]) => {
    sendMessage({
      type: 'update',
      data: { shapes }
    });
  }, [sendMessage]);

  // Send clear command
  const sendClear = useCallback(() => {
    sendMessage({
      type: 'clear'
    });
  }, [sendMessage]);

  // Send undo command
  const sendUndo = useCallback(() => {
    sendMessage({
      type: 'undo'
    });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    sendShapesUpdate,
    sendClear,
    sendUndo,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};
