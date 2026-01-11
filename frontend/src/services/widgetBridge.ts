// widgetBridge.ts
export interface WidgetInitPayload {
  widgetId: number;
  userId: number;
  role: string;
  config: any;
  board: {
    id: number;
    name: string;
    parentId: number;
  };
}

let widgetContext: WidgetInitPayload | null = null;
let onInitializedCallbacks: Array<(payload: WidgetInitPayload) => void> = [];

export const getInfo = (payload: WidgetInitPayload) => {
  if (!payload?.board?.id || typeof payload.board.id !== 'number') {
    throw new Error('Invalid board.id');
  }

  if (typeof payload.widgetId !== 'number') {
    throw new Error('Invalid widgetId');
  }

  widgetContext = payload;

  console.log('[Widget] Initialized with:', payload);

  // Уведомляем всех подписчиков
  onInitializedCallbacks.forEach(callback => callback(payload));

  return {
    widgetId: payload.widgetId,
    boardId: String(payload.board.id),
    userId: payload.userId,
    role: payload.role,
    config: payload.config,
  };
};

export const getWidgetContext = () => {
  if (!widgetContext) {
    throw new Error('Widget not initialized. Call getInfo first.');
  }
  return widgetContext;
};

// Подписка на инициализацию виджета
export const onWidgetInitialized = (callback: (payload: WidgetInitPayload) => void) => {
  onInitializedCallbacks.push(callback);
  
  // Если виджет уже инициализирован, вызываем callback сразу
  if (widgetContext) {
    callback(widgetContext);
  }
  
  // Функция для отписки
  return () => {
    const index = onInitializedCallbacks.indexOf(callback);
    if (index > -1) {
      onInitializedCallbacks.splice(index, 1);
    }
  };
};

// Получение только boardId (для обратной совместимости)
export const getBoardId = (): string => {
  if (!widgetContext) {
    throw new Error('Widget not initialized');
  }
  return String(widgetContext.board.id);
};