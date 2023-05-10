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

const URLImage = ({ image, draggable, setImage }) => {
  const [img] = useImage(image.src);
  return (
    <Image
      image={img}
      x={image.x}
      y={image.y}
      draggable={draggable}
      onDragEnd={(e) => {
        // https://konvajs.org/docs/react/Drag_And_Drop.html
        setImage({
          ...image,
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      // I will use offset to set origin to the center of the image
      offsetX={img ? img.width / 2 : 0}
      offsetY={img ? img.height / 2 : 0}
    />
  );
};

enum Tool {
  Pen = "pen",
  Eraser = "eraser",
  Move = "move",
}

enum Operation {
  FreeDraw = "draw",
  Erase = "erase",
  Drag = "drag",
  Import = "import",
}

export default function Home() {
  const [tool, setTool] = React.useState<Tool>(Tool.Pen);
  const [history, setHistory] = React.useState<
    {
      operation: Operation;
      tool?: Tool;
      color?: string;
      points?: number[];
      image?: {
        // file path, so this id might be duplicated
        id: string;
        src: string;
        x: number;
        y: number;
      };
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

  // color
  const [color, setColor] = React.useState([]);

  const addToHistory = (newOperation) => {
    let newHistory = history;
    if (history == null || history.length !== historyStep) {
      // clear old history logs
      newHistory = history.slice(0, historyStep);
    }

    setHistory([...newHistory, newOperation]);
    setHistoryStep(historyStep + 1);
  };

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
    if (tool !== Tool.Pen && tool !== Tool.Eraser) {
      return;
    }

    // https://konvajs.org/docs/react/Free_Drawing.html
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    const operation =
      tool === Tool.Pen
        ? Operation.FreeDraw
        : tool === Tool.Eraser
        ? Operation.Erase
        : null;

    addToHistory({
      operation,
      tool,
      color,
      points: [pos.x, pos.y],
    });
  };

  const handleMouseMove = (e) => {
    // no drawing - skipping
    if (!isDrawing.current) {
      return;
    }
    if (tool !== Tool.Pen && tool !== Tool.Eraser) {
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
        addToHistory({
          operation: Operation.Import,
          image: {
            id: file.name,
            src: e.target.result,
            x: 0,
            y: 0,
          },
        });
        setTool(Tool.Move);
      };
      reader.readAsDataURL(file);
    }
  };

  // https://codesandbox.io/s/jq5hm?file=/index.js:418-584
  const handleChangeColor = (event) => {
    setColor(event.target.value);
  };

  // let imageRendered: [id: string]: bool = {}
  let imageRendered: Object = {};

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
            <option value={Tool.Pen}>Pen</option>
            <option value={Tool.Eraser}>Eraser</option>
            <option value={Tool.Move}>Move</option>
          </select>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <input type="color" value={color} onChange={handleChangeColor} />
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
            .filter((historyOperation, i) => {
              if (i >= historyStep) {
                return false;
              }
              return (
                historyOperation.operation === Operation.FreeDraw ||
                historyOperation.operation === Operation.Erase
              );
            })
            .map((historyOperation, i) => {
              switch (historyOperation.tool) {
                case Tool.Pen:
                case Tool.Eraser:
                  return (
                    <Line
                      key={i}
                      points={historyOperation.points}
                      stroke={historyOperation.color}
                      strokeWidth={5}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={
                        historyOperation.tool === Tool.Eraser
                          ? "destination-out"
                          : "source-over"
                      }
                    />
                  );
              }
            })}
        </Layer>
        {history
          .filter((historyOperation, i) => {
            if (i >= historyStep) {
              return false;
            }
            return historyOperation.operation === Operation.Import;
          })
          .map((historyOperation, i) => {
            let image = historyOperation.image;
            if (imageRendered[image.id]) {
              return null;
            }

            for (let j = historyStep - 1; j >= i; j--) {
              if (history[j].image == null) {
                continue;
              }
              if (history[j].image.id !== image.id) {
                continue;
              }
              if (history[j].operation === Operation.Drag) {
                image.x = history[j].image.x;
                image.y = history[j].image.y;
                break;
              }
            }
            imageRendered[image.id] = true;
            console.log(history);

            return (
              <Layer key={image.id}>
                <URLImage
                  image={image}
                  draggable={tool === Tool.Move}
                  setImage={(imageProps) => {
                    addToHistory({
                      operation: Operation.Drag,
                      image: {
                        ...historyOperation,
                        ...imageProps,
                      },
                    });
                  }}
                />
              </Layer>
            );
          })}
      </Stage>
    </div>
  );
}
