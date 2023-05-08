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

// http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
function fill(canvas, startX, startY, color) {
  const canvasContext = canvas.getContext("2d");
  let imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
  let newImageData = imageData;
  imageData = imageData.data;

  const fillRed = parseInt(color.substring(1, 3), 16);
  const fillGreen = parseInt(color.substring(3, 5), 16);
  const fillBlue = parseInt(color.substring(5, 7), 16);

  const numberOfArrayPerPixel = 4;

  const canvasImageIndex =
    (canvas.width * startY + startX) * numberOfArrayPerPixel;
  const originalRed = imageData[canvasImageIndex];
  const originalGreen = imageData[canvasImageIndex + 1];
  const originalBlue = imageData[canvasImageIndex + 2];
  const originalAlpha = imageData[canvasImageIndex + 3];

  console.debug({
    imageData,
    canvasImageIndex,
    start: {
      x: startX,
      y: startY,
      r: originalRed,
      g: originalGreen,
      b: originalBlue,
    },
    fillRed,
    fillBlue,
    fillGreen,
    color,
    width: canvas.width,
    height: canvas.height,
  });

  let imageMap: {
    [index: number]: {
      [index: number]: number;
    };
  } = {};

  function searchFill(startX: number, startY: number) {
    const pixelStack: { y: number; x: number }[] = [{ y: startY, x: startX }];

    while (pixelStack.length > 0) {
      const { x, y } = pixelStack.pop()!;
      if (y < 0) {
        continue;
      }
      if (x < 0) {
        continue;
      }
      if (x >= canvas.width) {
        continue;
      }
      if (y >= canvas.height) {
        continue;
      }

      const canvasImageIndex = (canvas.width * y + x) * numberOfArrayPerPixel;
      const red = imageData[canvasImageIndex];
      const green = imageData[canvasImageIndex + 1];
      const blue = imageData[canvasImageIndex + 2];
      // TODO: No way to store an alpha yet
      const alpha = imageData[canvasImageIndex + 3];

      if (imageMap[y] == null) {
        imageMap[y] = {};
      }
      if (imageMap[y][x] === 1) {
        // already searched
        continue;
      }
      imageMap[y][x] = 1;

      if (
        red === originalRed &&
        blue === originalBlue &&
        green === originalGreen
      ) {
        newImageData.data[canvasImageIndex] = fillRed;
        newImageData.data[canvasImageIndex + 1] = fillGreen;
        newImageData.data[canvasImageIndex + 2] = fillBlue;
        newImageData.data[canvasImageIndex + 3] = 255; // alpha

        pixelStack.push({ x: x - 1, y });
        pixelStack.push({ x: x + 1, y });
        pixelStack.push({ x, y: y - 1 });
        pixelStack.push({ x, y: y + 1 });
      }
    }
  }

  searchFill(startX, startY);
  return newImageData;
}

enum Tool {
  Pen = "pen",
  Eraser = "eraser",
  Move = "move",
  Fill = "fill",
}

enum Operation {
  FreeDraw = "draw",
  Erase = "erase",
  Drag = "drag",
  Import = "import",
  Fill = "fill",
}

export default function Home() {
  const width = window.innerWidth;
  const height = window.innerHeight;
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
  const layerRef = React.useRef(null);

  // Import
  // https://konvajs.org/docs/react/Images.html
  // https://stackoverflow.com/questions/37457128/react-open-file-browser-on-click-a-div
  const inputFile = React.useRef<HTMLInputElement | null>(null);

  // color
  const [color, setColor] = React.useState("#000000");

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
    if (tool === Tool.Fill) {
      const pointerPos = stageRef.current.getPointerPosition();

      // Use FloodFill to fill the region around the clicked point
      // const canvas = layerRef.current.getCanvas();
      const canvas = stageRef.current.toCanvas();

      const imageData = fill(canvas, pointerPos.x, pointerPos.y, color);

      // Create a new canvas element with the filled imageData
      const filledCanvas = document.createElement("canvas");
      filledCanvas.width = canvas.width;
      filledCanvas.height = canvas.height;
      filledCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

      const filledImage = new window.Image();
      filledImage.src = filledCanvas.toDataURL();
      filledImage.onload = () => {
        addToHistory({
          operation: Operation.Fill,
          tool,
          image: filledImage,
        });
      };
      // canvas.floodFill(pointerPos.x, pointerPos.y, [], color);
      return;
    }
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
    let colorCode = event.target.value;
    setColor(event.target.value);
  };

  // let imageRendered: [id: string]: bool = {}
  let imageRendered: Object = {};

  let canvasContext = null;
  if (layerRef.current != null) {
    const canvas = layerRef.current.getCanvas();
    canvasContext = canvas.getContext("2d");
  }

  return (
    <div>
      <input
        type="file"
        id="file"
        ref={inputFile}
        style={{ display: "none" }}
        onChange={(e) => {
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
            <option value={Tool.Fill}>Fill</option>
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
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        ref={stageRef}
      >
        <Layer ref={layerRef}>
          {history
            .filter((historyOperation, i) => {
              if (i >= historyStep) {
                return false;
              }
              return (
                historyOperation.operation === Operation.FreeDraw ||
                historyOperation.operation === Operation.Erase ||
                historyOperation.operation === Operation.Fill
              );
            })
            .map((historyOperation, i) => {
              switch (historyOperation.tool) {
                case Tool.Fill:
                  return <Image key={i} image={historyOperation.image} />;
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
