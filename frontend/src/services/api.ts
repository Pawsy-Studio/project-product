// API service for sending canvas commands to backend
// Added for backend data sending logic

const API_BASE_URL = 'http://localhost:8000'; // Adjust to your backend URL

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export const sendCanvasCommand = async (
  boardId: string,
  action: 'clear' | 'undo' | 'update',
  data?: any
): Promise<ApiResponse> => {
  try {
    const url = `${API_BASE_URL}/api/canvas/${boardId}/${action}/`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Specific functions for each action
export const clearCanvas = async (boardId: string): Promise<ApiResponse> => {
  return sendCanvasCommand(boardId, 'clear');
};

export const undoAction = async (boardId: string): Promise<ApiResponse> => {
  return sendCanvasCommand(boardId, 'undo');
};

export const updateCanvasData = async (boardId: string, data: { shapes: any[], config?: any, history?: any[] }): Promise<ApiResponse> => {
  return sendCanvasCommand(boardId, 'update', data);
};

// Legacy function for backward compatibility
export const updateShapes = async (boardId: string, shapes: any[]): Promise<ApiResponse> => {
  return updateCanvasData(boardId, { shapes });
};
