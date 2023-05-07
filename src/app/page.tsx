"use client";

import React from "react";
import { Stage, Layer, Line, Image } from "react-konva";
import useImage from "use-image";

// function from https://stackoverflow.com/a/15832662/512042
function downloadURI(uri, name) {
  var link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const URLImage = ({ image }) => {
  const [img] = useImage(image.src);
  return (
    <Image
      image={img}
      x={image.x}
      y={image.y}
      // I will use offset to set origin to the center of the image
      offsetX={img ? img.width / 2 : 0}
      offsetY={img ? img.height / 2 : 0}
    />
  );
};

export default function Home() {
  const [tool, setTool] = React.useState("pen");
  const [history, setHistory] = React.useState<
    {
      tool: string;
      points: number[];
    }[]
  >([]);
  const isDrawing = React.useRef(false);
  // undo/redo: https://konvajs.org/docs/react/Undo-Redo.html
  const [historyStep, setHistoryStep] = React.useState(0);
  const stageRef = React.useRef(null);

  // Import
  // https://konvajs.org/docs/react/Images.html
  // https://stackoverflow.com/questions/37457128/react-open-file-browser-on-click-a-div
  const inputFile = React.useRef<HTMLInputElement | null>(null);
  const [images, setImages] = React.useState([]);

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

  const handleExport = () => {
    const uri = stageRef.current.toDataURL();
    console.log(uri);
    // we also can save uri as file
    // but in the demo on Konva website it will not work
    // because of iframe restrictions
    // but feel free to use it in your apps:
    downloadURI(uri, "stage.png");
  };

  const handleImport = () => {
    inputFile.current.click();
  };

  const handleFiles = (files) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith("image/")) {
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        console.log(e.target.result);
        setImages([
          ...images,
          {
            src: e.target.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        id="file"
        ref={inputFile}
        style={{ display: "none" }}
        onChange={(e) => {
          console.log(e);
          handleFiles(e.target.files);
        }}
      />

      <ul style={{ display: "inline-block" }}>
        <li style={{ display: "inline", padding: 2 }}>
          <button onClick={handleExport}>Export</button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <button onClick={handleImport}>Import</button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
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
        ref={stageRef}
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
        {images.map((image, i) => {
          return (
            <Layer key={i}>
              <URLImage image={image} />
            </Layer>
          );
        })}
      </Stage>
    </div>
  );
}
