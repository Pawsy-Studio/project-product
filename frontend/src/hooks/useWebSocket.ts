import { useEffect, useRef, useCallback, useState } from 'react';
import type { Shape } from '../types';

const WS_BASE_URL =
  import.meta.env.VITE_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface WebSocketMessage {
  type: 'init' | 'update' | 'clear' | 'undo' | 'shapes';
  data?: any;
  userId?: string;
}

export interface CanvasData {
  shapes: Shape[];
  config?: any;
  history?: any[];
}

export const useWebSocket = (
  boardId: string,
  onCanvasUpdate: (data: CanvasData) => void,
  userId: string = crypto.randomUUID()
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 1500;

  const [isConnected, setIsConnected] = useState(false);

  // всегда актуальный callback
  useEffect(() => {
    onCanvasUpdateRef.current = onCanvasUpdate;
  }, [onCanvasUpdate]);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    const ws = new WebSocket(
      `${WS_BASE_URL}/ws/canvas/${boardId}/`
    );

    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        if (message.userId === userId) return;

        switch (message.type) {
          case 'init':
            if (message.data) {
              onCanvasUpdateRef.current(message.data);
            }
            break;

          case 'update':
          case 'shapes':
          case 'undo':
            if (message.data) {
              onCanvasUpdateRef.current(message.data);
            }
            break;

          case 'clear':
            onCanvasUpdateRef.current({ shapes: [], config: {}, history: [] });
            break;

          default:
            console.warn('[WS] unknown message', message);
        }
      } catch (e) {
        console.error('[WS] message parse error', e);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] error', e);
    };

    ws.onclose = () => {
      console.log('[WS] disconnected');
      setIsConnected(false);
      wsRef.current = null;

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, RECONNECT_DELAY * reconnectAttempts.current);
      }
    };
  }, [boardId, userId]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    (message: WebSocketMessage) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ ...message, userId })
        );
      }
    },
    [userId]
  );

  const sendShapesUpdate = useCallback(
    (shapes: Shape[]) => {
      sendMessage({
        type: 'update',
        data: { shapes },
      });
    },
    [sendMessage]
  );

  const sendClear = useCallback(() => {
    sendMessage({ type: 'clear' });
  }, [sendMessage]);

  const sendUndo = useCallback(() => {
    sendMessage({ type: 'undo' });
  }, [sendMessage]);

  // ⬇️ подключаемся ТОЛЬКО при смене boardId
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    sendShapesUpdate,
    sendClear,
    sendUndo,
    isConnected,
  };
};
