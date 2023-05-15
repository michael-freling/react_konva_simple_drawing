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

type VectorLayerProps = LayerProps & {
  lines: {
    tool: Tool;
    color: string;
    points: number[];
  }[];
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
export default function App() {
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
  };

  return (
    <div>
      <select
        value={tool}
        onChange={(e) => {
          setTool(e.target.value as Tool);
        }}
      >
        <option value={Tool.Pen}>Pen</option>
        <option value={Tool.Eraser}>Eraser</option>
      </select>

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
