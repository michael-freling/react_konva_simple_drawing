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
  AddLayer = "add_layer",
  DeleteSelectedLayers = "delete_selected_layers",
}

enum LayerType {
  Vector = "vector",
  Raster = "raster",
  Image = "image",
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
      layers?: string[];
    }[]
  >([]);
  const isDrawing = React.useRef(false);
  // undo/redo: https://konvajs.org/docs/react/Undo-Redo.html
  const [historyStep, setHistoryStep] = React.useState(0);
  const stageRef = React.useRef(null);
  const initialLayerId = "initial-layer-1";
  const [layers, setLayers] = React.useState<
    {
      id: string;
      name: string;
      selected: boolean;
      deleted: boolean; // for undo/redo
      type: LayerType;
    }[]
  >([
    {
      id: initialLayerId,
      name: "Layer 1",
      selected: false,
      type: "vector",
    },
  ]);
  const [currentLayerId, setCurrentLayerId] = React.useState(layers[0].id);

  const currentLayersArray = layers.filter((layer, index) => {
    const isShown = history.filter((historyOperation, i) => {
      if (i >= historyStep) {
        return false;
      }
      if (
        historyOperation.operation !== Operation.AddLayer &&
        historyOperation.operation !== Operation.DeleteSelectedLayers &&
        historyOperation.operation !== Operation.Import
      ) {
        return false;
      }
      return historyOperation.layers!.includes(layer.id);
    });
    if (layer.id === initialLayerId) {
      if (isShown.length === 1) {
        return false;
      }
    } else if (isShown.length !== 1) {
      return false;
    }
    return true;
  });
  let currentLayers = {};
  currentLayersArray.forEach((layer) => {
    currentLayers[layer.id] = layer;
  });

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
    const currentLayer = currentLayers[currentLayerId];
    if (currentLayer.type === LayerType.Image) {
      // cannot edit anything on an image layer
      return;
    }

    if (tool === Tool.Fill) {
      const currentLayer = currentLayers[currentLayerId];
      if (currentLayer.type != LayerType.Raster) {
        console.error("Only raster layer is supported");
        return;
      }

      const pointerPos = stageRef.current.getPointerPosition();

      // TODO: Get all canvas from all layers, not only the current layer
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
          layers: [currentLayerId],
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
      layers: [currentLayerId],
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

  const newLayer = ({ name, type }) => {
    const layerId = "layer-" + (layers.length + 1);
    return {
      id: layerId,
      selected: false,
      deleted: false,
      name,
      type,
    };
  };

  const handleFiles = (files) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith("image/")) {
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setTool(Tool.Move);

        const layer = newLayer({
          name: file.name,
          type: LayerType.Image,
        });
        setLayers([...layers, layer]);
        addToHistory({
          operation: Operation.Import,
          image: {
            id: file.name,
            src: e.target.result,
            x: 0,
            y: 0,
          },
          layers: [layer.id],
        });
        setCurrentLayerId(layer.id);
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

  const handleAddLayer = (layerType: LayerType) => {
    const layer = newLayer({
      name: "Layer " + (layers.length + 1),
      type: layerType,
    });
    setLayers([...layers, layer]);
    addToHistory({
      operation: Operation.AddLayer,
      layers: [layer.id],
    });
  };

  const handleDeleteSelectedLayers = () => {
    const selectedLayers = layers.filter((layer) => layer.selected);
    if (selectedLayers.length === 0) {
      return;
    }

    const newLayers = layers.map((layer) => {
      if (layer.selected) {
        layer.deleted = true;
        layer.selected = false;
      }

      return layer;
    });

    if (newLayers.filter((layer) => !layer.deleted).length === 0) {
      console.error("Please keep at least one layer");
      return;
    }

    setLayers([...newLayers]);
    addToHistory({
      operation: Operation.DeleteSelectedLayers,
      layers: selectedLayers.map((layer) => layer.id),
    });
    if (
      newLayers.filter((layer) => layer.id === currentLayerId && !layer.deleted)
        .length === 0
    ) {
      setCurrentLayerId(newLayers[0].id);
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

      <ul style={{ display: "block" }}>
        <li style={{ display: "inline-block" }}>
          <button
            onClick={() => {
              handleAddLayer(LayerType.Vector);
            }}
          >
            Add a vector layer
          </button>
        </li>
        <li style={{ display: "inline-block" }}>
          <button
            onClick={() => {
              handleAddLayer(LayerType.Raster);
            }}
          >
            Add a raster layer
          </button>
        </li>
        <li style={{ display: "inline-block" }}>
          <button onClick={handleDeleteSelectedLayers}>
            Delete select layers
          </button>
        </li>
      </ul>

      <ul style={{ padding: 2 }}>
        {Object.keys(currentLayers).map((id) => {
          const layer = currentLayers[id];

          return (
            <li key={layer.id} style={{ padding: 2 }}>
              <input
                type="checkbox"
                id={layer.id}
                checked={layer.selected}
                onChange={() => {
                  setCurrentLayerId(layer.id);
                  layers.forEach((l, j) => {
                    if (l.id == layer.id) {
                      layers[j].selected = !l.selected;
                    }
                  });
                  setLayers([...layers]);
                }}
              />
              <label htmlFor={layer.id}>
                {layer.id === currentLayerId ? (
                  <span style={{ backgroundColor: "yellow" }}>
                    {layer.name} ({layer.type})
                  </span>
                ) : (
                  layer.name + " (" + layer.type + ")"
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <Stage
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        ref={stageRef}
        style={{ backgroundColor: "rgb(128, 128, 128)" }}
      >
        {Object.keys(currentLayers).map((id) => {
          const layer = currentLayers[id];

          return (
            <Layer key={layer.id}>
              {history
                .filter((historyOperation, i) => {
                  if (i >= historyStep) {
                    return false;
                  }
                  if (
                    historyOperation.operation === Operation.FreeDraw ||
                    historyOperation.operation === Operation.Erase ||
                    historyOperation.operation === Operation.Fill
                  ) {
                    return historyOperation.layers?.includes(layer.id);
                  }
                })
                .map((historyOperation, i) => {
                  switch (historyOperation.tool) {
                    case Tool.Fill:
                      return <Image key={i} image={historyOperation.image} />;
                    case Tool.Eraser:
                    case Tool.Pen:
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

              {history
                .filter((historyOperation, i) => {
                  if (i >= historyStep) {
                    return false;
                  }
                  if (historyOperation.operation === Operation.Import) {
                    return historyOperation.layers?.includes(layer.id);
                  }
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

                  const draggable =
                    layer.id === currentLayerId && tool === Tool.Move;

                  return (
                    <URLImage
                      key={layer.id}
                      image={image}
                      draggable={draggable}
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
                  );
                })}
            </Layer>
          );
        })}
      </Stage>
    </div>
  );
}
