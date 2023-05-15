import Konva from "konva";
import React from "react";
import { Stage, Layer, Line, Text, Group } from "react-konva";

enum LayerType {
  Vector = "vector",
}

type LayerProps = {
  id: string;
  name: string;
  type: LayerType;
  isCurrent: true;
};

enum Tool {
  Pen = "pen",
  Eraser = "eraser",
}

type FreeDrawLine = {
  tool: Tool;
  color: string;
  points: number[];
};
type VectorLayerProps = LayerProps & {
  lines: FreeDrawLine[];
};

function VectorLayer({ id, lines }: VectorLayerProps) {
  return (
    <Group key={id}>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          stroke={line.color}
          strokeWidth={5}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation={
            line.tool === Tool.Eraser ? "destination-out" : "source-over"
          }
        />
      ))}
    </Group>
  );
}

interface Command {
  undo(): void;
  redo(): void;
}

export default function App() {
  const [history, setHistory] = React.useState<Command[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const [layers, setLayers] = React.useState<VectorLayerProps[]>([
    {
      id: "layer-1",
      name: "Layer 1",
      type: LayerType.Vector,
      isCurrent: true,
      lines: [],
    },
  ]);

  const [tool, setTool] = React.useState(Tool.Pen);
  const [color] = React.useState("#00ff00");
  const [isDrawing, setIsDrawing] = React.useState(false);

  const currentLayer = layers.filter((layer) => layer.isCurrent)[0];
  const currentLayerIndex = layers.findIndex((layer) => layer.isCurrent);

  class FreeDrawCommand implements Command {
    layerIndex: number;
    lines: FreeDrawLine[];

    constructor(layerIndex: number, lines: FreeDrawLine[]) {
      this.layerIndex = layerIndex;
      this.lines = lines.concat();
    }

    undo() {
      layers[this.layerIndex].lines = layers[this.layerIndex].lines.slice(
        0,
        this.lines.length - 1
      );
      setLayers([...layers]);
    }

    redo() {
      layers[this.layerIndex].lines = this.lines;
      setLayers([...layers]);
    }
  }

  const addToHistory = (newCommand: Command) => {
    setHistory([...history, newCommand]);
    setHistoryIndex(historyIndex + 1);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsDrawing(true);
    const point = e.target.getStage()!.getPointerPosition()!;

    layers[currentLayerIndex].lines.push({
      tool,
      color,
      points: [point.x, point.y],
    });
    setLayers([...layers]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // no drawing - skipping
    if (!isDrawing) {
      return;
    }
    const point = e.target.getStage()!.getPointerPosition()!;

    const lines = currentLayer.lines;
    let lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    lines.splice(lines.length - 1, 1, lastLine);
    layers[currentLayerIndex].lines = lines;
    setLayers([...layers]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    switch (tool) {
      case Tool.Pen:
      case Tool.Eraser:
        addToHistory(
          new FreeDrawCommand(currentLayerIndex, currentLayer.lines)
        );
        break;
    }
  };

  const handleUndo = () => {
    if (historyIndex <= 0) {
      return;
    }

    setHistoryIndex(historyIndex - 1);
    const command = history[historyIndex - 1];
    command.undo();
  };

  const handleRedo = () => {
    if (historyIndex >= history.length) {
      return;
    }

    const command = history[historyIndex];
    command.redo();
    setHistoryIndex(historyIndex + 1);
  };

  return (
    <div>
      <ul style={{ display: "inline-block" }}>
        <li style={{ display: "inline", padding: 2 }}>
          <select
            value={tool}
            onChange={(e) => {
              setTool(e.target.value as Tool);
            }}
          >
            <option value={Tool.Pen}>Pen</option>
            <option value={Tool.Eraser}>Eraser</option>
          </select>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <button onClick={handleUndo}>undo</button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <button onClick={handleRedo}>redo</button>
        </li>
      </ul>

      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        style={{ backgroundColor: "rgb(128, 128, 128)" }}
      >
        <Layer>
          <Text text="Just start drawing" x={5} y={30} />
          {layers.map((layer) => (
            <VectorLayer key={layer.id} {...layer} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
