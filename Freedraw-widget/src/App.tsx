import {
  ReactSketchCanvas,
  type ReactSketchCanvasRef,
} from "react-sketch-canvas";
import { type ChangeEvent, useRef, useState } from "react";

interface AppProps {
  onCanvasMouseEnter?: () => void;
  onCanvasMouseLeave?: () => void;
  isDraggable?: boolean;
}

export default function App({ 
  onCanvasMouseEnter, 
  onCanvasMouseLeave, 
  isDraggable = true 
}: AppProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [eraseMode, setEraseMode] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [eraserWidth, setEraserWidth] = useState(10);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeOpacity, setStrokeOpacity] = useState(100);
  const [canvasColor, setCanvasColor] = useState("#ffffff");

  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  };

  const handleStrokeColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStrokeColor(event.target.value);
  };

  const handleCanvasColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCanvasColor(event.target.value);
  };

  const handleStrokeOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStrokeOpacity(+event.target.value);
  };

  const handleEraserClick = () => {
    setEraseMode(true);
    canvasRef.current?.eraseMode(true);
  };

  const handlePenClick = () => {
    setEraseMode(false);
    canvasRef.current?.eraseMode(false);
  };

  const handleStrokeWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStrokeWidth(+event.target.value);
  };

  const handleEraserWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEraserWidth(+event.target.value);
  };

  const handleUndoClick = () => {
    canvasRef.current?.undo();
  };

  const handleRedoClick = () => {
    canvasRef.current?.redo();
  };

  const handleClearClick = () => {
    canvasRef.current?.clearCanvas();
  };

  return (
    <div className="tools-container">
      <h1 className="tools-title">Tools</h1>
      <div className="tools-controls">
        <div className="vertical-divider" />
        <button
          type="button"
          className="btn btn-control btn-undo"
          onClick={handleUndoClick}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn btn-control btn-redo"
          onClick={handleRedoClick}
        >
          Redo
        </button>
        <button
          type="button"
          className="btn btn-control btn-clear"
          onClick={handleClearClick}
        >
          Clear
        </button>
        <label htmlFor="color" className="color-label">Stroke color</label>
        <input
          type="color"
          className="color-input"
          value={strokeColor}
          onChange={handleStrokeColorChange}
        />
        <label htmlFor="strokeOpacity" className="slider-label">
          Stroke opacity
        </label>
        <input
          disabled={eraseMode}
          type="range"
          className="opacity-slider"
          min="0"
          max="100"
          step="1"
          id="strokeOpacity"
          value={strokeOpacity}
          onChange={handleStrokeOpacityChange}
        />
        <label htmlFor="color" className="color-label">Canvas color</label>
        <input
          type="color"
          className="color-input"
          value={canvasColor}
          onChange={handleCanvasColorChange}
        />
        <button
          type="button"
          className="btn btn-control btn-pen"
          disabled={!eraseMode}
          onClick={handlePenClick}
        >
          Pen
        </button>
        <button
          type="button"
          className="btn btn-control btn-eraser"
          disabled={eraseMode}
          onClick={handleEraserClick}
        >
          Eraser
        </button>
        <label htmlFor="strokeWidth" className="slider-label">
          Stroke width
        </label>
        <input
          disabled={eraseMode}
          type="range"
          className="width-slider"
          min="1"
          max="20"
          step="1"
          id="strokeWidth"
          value={strokeWidth}
          onChange={handleStrokeWidthChange}
        />
        <label htmlFor="eraserWidth" className="slider-label">
          Eraser width
        </label>
        <input
          disabled={!eraseMode}
          type="range"
          className="width-slider"
          min="1"
          max="20"
          step="1"
          id="eraserWidth"
          value={eraserWidth}
          onChange={handleEraserWidthChange}
        />
      </div>
      <h1 className="canvas-title">Canvas</h1>
      <div
        className="canvas-wrapper"
        onMouseEnter={onCanvasMouseEnter}
        onMouseLeave={onCanvasMouseLeave}
        style={{
          pointerEvents: 'auto',
          cursor: isDraggable ? 'default' : 'crosshair',
        }}
      >
        <ReactSketchCanvas
          ref={canvasRef}
          strokeWidth={strokeWidth}
          strokeColor={hexToRgba(strokeColor, strokeOpacity)}
          canvasColor={canvasColor}
          eraserWidth={eraserWidth}
          style={{
            cursor: isDraggable ? 'default' : 'crosshair', 
            border: '2px solid #000',
            width: '100%',
            height: '387px',
            pointerEvents: 'auto',
          }}
        />
      </div>
    </div>
  );
}