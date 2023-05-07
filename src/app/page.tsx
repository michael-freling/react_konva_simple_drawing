"use client";

import React from "react";
import { Stage, Layer, Line, Text } from "react-konva";

export default function Home() {
  const [tool, setTool] = React.useState("pen");
  const [history, setHistory] = React.useState<
    {
      tool: string;
      points: number[];
    }[]
  >([]);
  const isDrawing = React.useRef(false);
  // undo/redo
  const [historyStep, setHistoryStep] = React.useState(0);

  // https://konvajs.org/docs/react/Undo-Redo.html
  const handleUndo = () => {
    if (historyStep === 0) {
      return;
    }
    setHistoryStep(historyStep - 1);
  };

  const handleRedo = () => {
    if (historyStep === history.length) {
      return;
    }
    setHistoryStep(historyStep + 1);
  };

  const handleMouseDown = (e) => {
    // https://konvajs.org/docs/react/Free_Drawing.html
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setHistory([...history, { tool, points: [pos.x, pos.y] }]);
    setHistoryStep(historyStep + 1);
  };

  const handleMouseMove = (e) => {
    // no drawing - skipping
    if (!isDrawing.current) {
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = history[history.length - 1];
    // add point
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    // replace last
    history.splice(history.length - 1, 1, lastLine);
    setHistory(history.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  return (
    <div>
      <ul style={{ display: "inline-block" }}>
        <li style={{ display: "inline" }}>
          <select
            value={tool}
            onChange={(e) => {
              setTool(e.target.value);
            }}
          >
            <option value="pen">Pen</option>
            <option value="eraser">Eraser</option>
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
      >
        <Layer>
          {history
            .filter((_, i) => {
              return i < historyStep;
            })
            .map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke="#df4b26"
                strokeWidth={5}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === "eraser" ? "destination-out" : "source-over"
                }
              />
            ))}
        </Layer>
      </Stage>
    </div>
  );
}
