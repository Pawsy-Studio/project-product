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

export const onWidgetInitialized = (callback: (payload: WidgetInitPayload) => void) => {
  onInitializedCallbacks.push(callback);

  if (widgetContext) {
    callback(widgetContext);
  }

  return () => {
    const index = onInitializedCallbacks.indexOf(callback);
    if (index > -1) {
      onInitializedCallbacks.splice(index, 1);
    }
  };
};

export const getBoardId = (): string => {
  if (!widgetContext) {
    throw new Error('Widget not initialized');
  }
  return String(widgetContext.board.id);
};