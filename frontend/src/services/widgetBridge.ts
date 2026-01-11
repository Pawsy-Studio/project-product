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

export const getInfo = (payload: WidgetInitPayload) => {
  if (!payload?.board?.id || typeof payload.board.id !== 'number') {
    throw new Error('Invalid board.id');
  }

  if (typeof payload.widgetId !== 'number') {
    throw new Error('Invalid widgetId');
  }

  widgetContext = payload;

  console.log('[Widget] Initialized with:', payload);

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
