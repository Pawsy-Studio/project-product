import React, { useCallback, useState, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import App from './App.tsx'; 

type WidgetNodeData = {
  // Убрано свойство label так как оно больше не используется
};

const WidgetNode = ({ data }: { data: WidgetNodeData }) => {
  const [isOverCanvas, setIsOverCanvas] = useState(false);

  return (
    <div style={{ 
      width: 800, 
      height: 600, 
      border: '2px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#fff',
      overflow: 'hidden'
    }}>
      {/* Область для перетаскивания - теперь без текста */}
      <div 
        style={{
          height: '40px',
          background: '#f0f0f0',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          cursor: isOverCanvas ? 'default' : 'move',
        }}
        className="react-flow__handle"
      >
        {/* Текст полностью убран */}
      </div>
      
      <App 
        onCanvasMouseEnter={() => setIsOverCanvas(true)}
        onCanvasMouseLeave={() => setIsOverCanvas(false)}
        isDraggable={!isOverCanvas}
      />
    </div>
  );
};

const nodeTypes = {
  widget: WidgetNode,
};

const Board: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNewWidget = useCallback(() => {
    const newNode: Node = {
      id: `widget-${Date.now()}`,
      type: 'widget',
      data: {}, // Пустой объект данных
      position: { 
        x: Math.random() * 400, 
        y: Math.random() * 400 
      },
      style: {
        width: 800,
        height: 600,
      },
      draggable: true,
      dragHandle: '.react-flow__handle',
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const nodeColor = (node: Node) => {
    switch (node.type) {
      case 'widget':
        return '#007bff';
      default:
        return '#ccc';
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        zIndex: 1000,
        display: 'flex',
        gap: '10px'
      }}>
        <button 
          onClick={addNewWidget}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Добавить виджет
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap 
          nodeColor={nodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={12} 
          size={1} 
        />
      </ReactFlow>
    </div>
  );
};

const BoardWithProvider: React.FC = () => (
  <ReactFlowProvider>
    <Board />
  </ReactFlowProvider>
);

export default BoardWithProvider;