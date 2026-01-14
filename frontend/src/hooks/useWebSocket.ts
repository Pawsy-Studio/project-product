import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
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

  const boardIdRef = useRef(boardId);
  const userIdRef = useRef(userId);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 1500;

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    boardIdRef.current = boardId;
  }, [boardId]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    onCanvasUpdateRef.current = onCanvasUpdate;
  }, [onCanvasUpdate]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected, skipping');
      return;
    }

    // if (wsRef.current) {
    //   wsRef.current.close();
    //   wsRef.current = null;
    // }

    const ws = new WebSocket(
      `${WS_BASE_URL}/ws/canvas/${boardIdRef.current}/`
    );

    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to board:', boardIdRef.current);
      setIsConnected(true);
      reconnectAttempts.current = 0;

      ws.send(JSON.stringify({
        type: 'init',
        userId: userIdRef.current
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        if (message.userId === userIdRef.current) return;

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
            console.warn('[WS] Unknown message type:', message.type);
        }
      } catch (e) {
        console.error('[WS] Message parse error:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] Connection error:', e);
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected, code:', event.code, 'reason:', event.reason);
      setIsConnected(false);
      wsRef.current = null;

      if (event.code === 1000) return;

      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;
        console.log(`[WS] Reconnecting in ${RECONNECT_DELAY * reconnectAttempts.current}ms (attempt ${reconnectAttempts.current})`);

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, RECONNECT_DELAY * reconnectAttempts.current);
      } else {
        console.error('[WS] Max reconnection attempts reached');
      }
    };
  }, []); 

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ ...message, userId: userIdRef.current })
      );
    } else {
      console.warn('[WS] Cannot send message - connection not open');
    }
  }, []);

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

  useEffect(() => {
    console.log('[WS] Setting up connection for board:', boardId);
    connect();

    return () => {
      console.log('[WS] Cleaning up connection for board:', boardId);
      disconnect();
    };
  }, [boardId]);

  return useMemo(() => ({
    sendShapesUpdate,
    sendClear,
    sendUndo,
    isConnected,
  }), [sendShapesUpdate, sendClear, sendUndo, isConnected]);
};