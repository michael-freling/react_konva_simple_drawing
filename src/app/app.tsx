import Konva from "konva";
import React from "react";
import { Stage, Layer as KonvaLayer, Line, Image } from "react-konva";
import useImage from "use-image";
import {
  LayerType,
  Layer,
  Tool,
  Operation,
  OperationType,
  AppState,
  ImageLayer,
  ImageLayerProps,
} from "@/components/type";
import {
  newAddLayerCommand,
  newDeleteSelectedLayersCommand,
} from "@/components/layer";
import { newImportImageCommand } from "@/components/file";

// function from https://stackoverflow.com/a/15832662/512042
function downloadURI(uri: string, name: string) {
  var link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const URLImage = ({
  image,
  draggable,
  setImage,
}: {
  image: ImageLayerProps;
  draggable: boolean;
  setImage: (props: ImageLayerProps) => void;
}) => {
  const [img] = useImage(image.src);
  return (
    <Image
      image={img}
      alt={image.id}
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
    />
  );
};

// http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
function fill(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  color: string
) {
  const canvasContext = canvas.getContext("2d");
  let canvasContextImageData = canvasContext!.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  let newImageData = canvasContextImageData;
  const imageData = canvasContextImageData.data;

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

export default function Home() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const [tool, setTool] = React.useState<Tool>(Tool.Pen);
  const [history, setHistory] = React.useState<OperationType[]>([]);
  const isDrawing = React.useRef(false);
  // undo/redo: https://konvajs.org/docs/react/Undo-Redo.html
  const [historyStep, setHistoryStep] = React.useState(0);
  const stageRef = React.useRef<Konva.Stage>(null);
  const [layers, setLayers] = React.useState<Layer[]>([
    {
      id: "layer-1",
      name: "Layer 1",
      selected: false,
      isInitialLayer: true,
      type: LayerType.Vector,
    },
  ]);
  const [currentLayerId, setCurrentLayerId] = React.useState(layers[0].id);

  let currentLayers: {
    [id: string]: Layer;
  } = {};
  layers.forEach((layer) => {
    currentLayers[layer.id] = layer;
  });

  const appState: AppState = {
    layers,
    setLayers,
    currentLayerId,
    setCurrentLayerId,
    tool,
    setTool,
  };

  // Import
  // https://konvajs.org/docs/react/Images.html
  // https://stackoverflow.com/questions/37457128/react-open-file-browser-on-click-a-div
  const importFileRef = React.useRef<HTMLInputElement | null>(null);
  const loadFileRef = React.useRef<HTMLInputElement | null>(null);

  // color
  const [color, setColor] = React.useState("#000000");

  const addToHistory = (newOperation: OperationType) => {
    let newHistory = history;
    if (history == null || history.length !== historyStep) {
      // clear old history logs
      newHistory = history.slice(0, historyStep);
    }

    setHistory([...newHistory, newOperation]);
    setHistoryStep(historyStep + 1);

    if (newOperation.run != null) {
      newOperation.run(appState);
    }
  };

  // https://konvajs.org/docs/react/Undo-Redo.html
  const handleUndo = () => {
    if (historyStep === 0) {
      return;
    }
    const newHistoryStep = historyStep - 1;
    setHistoryStep(newHistoryStep);

    const command = history[newHistoryStep];
    if (command.undo != null) {
      command.undo(appState);
    }
  };

  const handleRedo = () => {
    if (historyStep === history.length) {
      return;
    }
    const command = history[historyStep];
    if (command.run != null) {
      command.run(appState);
      setHistoryStep(historyStep + 1);
      return;
    }
    setHistoryStep(historyStep + 1);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
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

      const pointerPos = stageRef.current!.getPointerPosition()!;

      // TODO: Get all canvas from all layers, not only the current layer
      const canvas = stageRef.current!.toCanvas();

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
          fillImageData: filledImage,
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
    const pos = e.target.getStage()!.getPointerPosition()!;
    let operation = Operation.FreeDraw;
    if (tool === Tool.Eraser) {
      operation = Operation.Erase;
    }

    addToHistory({
      operation,
      tool,
      color,
      points: [pos.x, pos.y],
      layers: [currentLayerId],
    });
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // no drawing - skipping
    if (!isDrawing.current) {
      return;
    }
    if (tool !== Tool.Pen && tool !== Tool.Eraser) {
      return;
    }

    const stage = e.target.getStage()!;
    const point = stage.getPointerPosition()!;
    let lastLine = history[history.length - 1];
    // add point
    lastLine.points = lastLine.points!.concat([point.x, point.y]);

    // replace last
    history.splice(history.length - 1, 1, lastLine);
    setHistory(history.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleExport = () => {
    const uri = stageRef.current!.toDataURL();
    // we also can save uri as file
    // but in the demo on Konva website it will not work
    // because of iframe restrictions
    // but feel free to use it in your apps:
    downloadURI(uri, "stage.png");
  };

  const handleImport = () => {
    importFileRef.current!.click();
  };

  const handleImportFiles = (files: FileList) => {
    const command = newImportImageCommand(files);
    addToHistory(command);
  };

  // https://codesandbox.io/s/jq5hm?file=/index.js:418-584
  const handleChangeColor = (event: React.ChangeEvent<HTMLInputElement>) => {
    let colorCode = event.target.value;
    setColor(event.target.value);
  };

  let imageRendered: {
    [id: string]: boolean;
  } = {};

  const handleAddLayer = (layerType: LayerType) => {
    const layer = newLayer({
      name: "Layer " + (layers.length + 1),
      type: layerType,
    });
    const command = newAddLayerCommand(layer, currentLayerId);
    addToHistory(command);
  };

  const handleDeleteSelectedLayers = () => {
    const command = newDeleteSelectedLayersCommand(layers);
    if (command.selectedLayers.length === 0) {
      console.error("Please select at least one layer");
      return;
    }
    if (command.newLayers.length === 0) {
      console.error("Please keep at least one layer");
      return;
    }

    addToHistory(command);
  };

  const handleSave = () => {
    const json: {
      layers: {
        id: string;
        name: string;
        type: LayerType;
        // vector
        operations?: {
          tool: Tool;
          color?: string;
          points: number[];
        }[];

        // raster and import
        data?: string;
        x?: number;
        y?: number;
      }[];
    } = {
      layers: [],
    };
    let konvaLayers: {
      [id: string]: Konva.Layer;
    } = {};
    stageRef.current!.getLayers().forEach((konvaLayer) => {
      konvaLayers[konvaLayer.id()] = konvaLayer;
    });

    console.debug({ json });
    Object.keys(currentLayers).map((id) => {
      const currentLayer = currentLayers[id];

      switch (currentLayer.type) {
        case LayerType.Image:
        case LayerType.Raster:
          const dataURL = konvaLayers[currentLayer.id].toDataURL();
          json.layers.push({
            id: currentLayer.id,
            name: currentLayer.name,
            type: currentLayer.type,
            data: dataURL,
            x: 0,
            y: 0,
          });
          break;
        case LayerType.Vector:
          const operations = history.filter((historyOperation) => {
            if (historyOperation.layers == null) {
              return false;
            }

            if (!historyOperation.layers.includes(currentLayer.id)) {
              return false;
            }
            return true;
          });

          const operationJson = operations
            .map((operation) => {
              switch (operation.tool) {
                case Tool.Pen:
                  return {
                    tool: Tool.Pen,
                    points: operation.points,
                    color: operation.color,
                  };
                case Tool.Eraser:
                  return {
                    tool: Tool.Eraser,
                    points: operation.points,
                  };
                default:
                  console.warn(operation);
                  return null;
              }
            })
            .filter((result) => result != null);
          json.layers.push({
            id: currentLayer.id,
            name: currentLayer.name,
            type: currentLayer.type,
            operations: operationJson as any,
          });
      }
    });
    var dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(json));

    var link = document.createElement("a");
    link.download = "scene.json";
    link.href = dataStr;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoad = () => {
    loadFileRef.current!.click();
  };

  const loadFile = (files: FileList) => {
    if (files.length > 1) {
      return;
    }
    if (files.length === 0) {
      return;
    }

    const file = files[0];

    if (!file.type.includes("json")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      let updatedLayers: Layer[] = [];
      // TODO: Update not to store the data into the history
      const updatedHistory: OperationType[] = [];

      const json = JSON.parse(e.target!.result as string);

      console.debug({ json });
      json.layers.forEach(
        (layer: {
          id: string;
          name: string;
          type: LayerType;
          // vector
          operations?: {
            tool: Tool;
            color?: string;
            points: number[];
          }[];

          // raster and import
          data?: string;
          x?: number;
          y?: number;
        }) => {
          switch (layer.type) {
            case LayerType.Raster:
            case LayerType.Image:
              const imageData = layer.data;
              updatedLayers.push({
                id: layer.id,
                name: layer.name,
                type: layer.type,
                selected: false,
                isInitialLayer: false, // TODO want to replace it later
              });
              updatedHistory.push({
                operation: Operation.Import,
                image: {
                  id: layer.id,
                  src: imageData!,
                  x: layer.x!,
                  y: layer.y!,
                },
                layers: [layer.id],
              });
              break;
            case LayerType.Vector:
              updatedLayers.push({
                id: layer.id,
                name: layer.name,
                type: layer.type,
                selected: false,
                isInitialLayer: true,
              });
              layer.operations!.forEach(
                (operation: {
                  tool: Tool;
                  color?: string;
                  points: number[];
                }) => {
                  if (operation.tool === Tool.Pen) {
                    updatedHistory.push({
                      operation: Operation.FreeDraw,
                      tool: operation.tool,
                      points: operation.points,
                      color: operation.color,
                      layers: [layer.id],
                    });
                  } else {
                    updatedHistory.push({
                      operation: Operation.Erase,
                      tool: operation.tool,
                      points: operation.points,
                      layers: [layer.id],
                    });
                  }
                }
              );
              break;
          }
        }
      );
      console.debug({
        updatedLayers,
        updatedHistory,
      });
      setLayers(updatedLayers);
      setHistory(updatedHistory);
      setHistoryStep(updatedHistory.length);
      setCurrentLayerId(updatedLayers[0].id);
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <input
        type="file"
        id="file"
        ref={loadFileRef}
        style={{ display: "none" }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          loadFile(e.target.files!);
        }}
      />

      <input
        type="file"
        id="file"
        ref={importFileRef}
        style={{ display: "none" }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          handleImportFiles(e.target.files!);
        }}
      />

      <ul style={{ display: "inline-block" }}>
        <li style={{ display: "inline", padding: 2 }}>
          <button onClick={handleSave}>Save</button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <button onClick={handleLoad}>Load</button>
        </li>

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
              setTool(e.target.value as Tool);
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
          let image = null;
          if (layer.type === LayerType.Image) {
            const image = (layer as ImageLayer).image;
            console.log(layer);
            const updatedPosition = history
              .filter((_, i) => i < historyStep)
              .map((historyOperation, i) => {
                let image = historyOperation.image!;
                for (let j = historyStep - 1; j >= i; j--) {
                  if (history[j].image == null) {
                    continue;
                  }
                  if (history[j].image!.id !== image.id) {
                    continue;
                  }
                  if (history[j].operation === Operation.Drag) {
                    return history[j].image!;
                  }
                }
              });
            if (updatedPosition.length > 0) {
              image.x = updatedPosition[0]?.x;
              image.y = updatedPosition[0]?.y;
            }
          }

          return (
            <KonvaLayer id={layer.id} key={layer.id}>
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
                      return (
                        <Image
                          key={i}
                          alt={historyOperation.image!.id}
                          image={historyOperation.fillImageData!}
                        />
                      );
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

              {image != null && (
                <URLImage
                  key={layer.id}
                  image={image}
                  draggable={layer.id === currentLayerId && tool === Tool.Move}
                  setImage={(imageProps) => {
                    addToHistory({
                      operation: Operation.Drag,
                      image: {
                        ...image,
                        ...imageProps,
                      },
                    });
                  }}
                />
              )}
            </KonvaLayer>
          );
        })}
      </Stage>
    </div>
  );
}
