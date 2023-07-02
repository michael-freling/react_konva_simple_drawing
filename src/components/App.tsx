import Konva from "konva";
import React from "react";
import { Stage, Layer, Line, Text, Group, Image } from "react-konva";
import useImage from "use-image";
import {
  ActionType,
  AppAction,
  AppState,
  AppStatusCode,
  DrawingFile,
  ImageLayerProps,
  LayerType,
  MouseEventType,
  RasterLayerProps,
  Tool,
  VectorLayerProps,
  appReducer,
  createLayer,
  initialState,
} from "./AppReducer";
import { Color } from "./Color";
import AppCanvas from "./AppCanvas";

class PromiseFileReader {
  fileReader: FileReader;

  constructor() {
    this.fileReader = new FileReader();
  }

  readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      this.fileReader.onload = (e: ProgressEvent<FileReader>) => {
        resolve(e.target!.result as string);
      };
      this.fileReader.onerror = (e: ProgressEvent<FileReader>) => {
        reject(this.fileReader.error);
      };
      this.fileReader.readAsDataURL(file);
    });
  }

  readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      this.fileReader.onload = (e: ProgressEvent<FileReader>) => {
        resolve(e.target!.result as string);
      };
      this.fileReader.onerror = (e: ProgressEvent<FileReader>) => {
        reject(this.fileReader.error);
      };
      this.fileReader.readAsText(file);
    });
  }
}

// function from https://stackoverflow.com/a/15832662/512042
export function downloadURI(uri: string, name: string) {
  var link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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

function RasterLayer({ id, canvasImage, image }: RasterLayerProps) {
  const [usedImage] = useImage(image != null ? image.dataURL : "");

  let img = canvasImage;
  if (image != null) {
    img = usedImage;
  }
  return (
    <Group key={id} id={id}>
      {img && <Image alt={id} image={img} />}
    </Group>
  );
}

function ImageLayer({
  id,
  draggable,
  image,
  setPosition,
}: ImageLayerProps & {
  draggable: boolean;
  setPosition: ({ x, y }: { x: number; y: number }) => void;
}) {
  const [img] = useImage(image.dataURL);

  return (
    <Image
      id={id}
      key={id}
      image={img}
      alt={"imageLayer-" + id}
      x={image.x}
      y={image.y}
      draggable={draggable}
      onDragEnd={(e) => {
        // https://konvajs.org/docs/react/Drag_And_Drop.html
        setPosition({
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
    />
  );
}

export default function App() {
  const [state, dispatch] = React.useReducer<
    (state: AppState, action: AppAction) => AppState
  >(appReducer, initialState);

  const layers = state.layers;
  const currentLayer = layers[state.currentLayerIndex];

  const stageRef = React.useRef<Konva.Stage>(null);
  const loadFileRef = React.useRef<HTMLInputElement | null>(null);
  // Import
  // https://konvajs.org/docs/react/Images.html
  // https://stackoverflow.com/questions/37457128/react-open-file-browser-on-click-a-div
  const importFileRef = React.useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = React.useState(Tool.Pen);
  const [color, setColor] = React.useState<Color>("#000000");

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const point = e.target.getStage()!.getPointerPosition()!;
    if (tool === Tool.Fill) {
      if (currentLayer.type === LayerType.Raster) {
        // TODO: Get all canvas from all layers, not only the current layer
        const canvas = stageRef.current!.toCanvas();
        const imageData = AppCanvas.fill(canvas, point.x, point.y, color);
        // Create a new canvas element with the filled imageData
        const filledCanvas = document.createElement("canvas");
        filledCanvas.width = canvas.width;
        filledCanvas.height = canvas.height;
        filledCanvas.getContext("2d")!.putImageData(imageData, 0, 0);

        const filledImage = new window.Image();
        filledImage.src = filledCanvas.toDataURL();
        dispatch({
          type: ActionType.FillColor,
          image: filledImage,
        });
      }
      return;
    }

    dispatch({
      type: ActionType.DrawOnCanvas,
      mouseEventType: MouseEventType.Down,
      color,
      tool,
      point,
    });
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const point = e.target.getStage()!.getPointerPosition()!;
    dispatch({
      type: ActionType.DrawOnCanvas,
      mouseEventType: MouseEventType.Move,
      color: color,
      tool: tool,
      point,
    });
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const point = e.target.getStage()!.getPointerPosition()!;
    dispatch({
      type: ActionType.DrawOnCanvas,
      mouseEventType: MouseEventType.Up,
      color: color,
      tool: tool,
      point,
    });
  };

  const handleSave = () => {
    const json: DrawingFile = {
      layers: [],
    };
    const konvaLayer = stageRef.current!.getLayers()[0];

    state.layers.forEach((layer) => {
      switch (layer.type) {
        case LayerType.Image:
          const image = konvaLayer.find("#" + layer.id)[0];
          const dataURL = image?.toDataURL();
          const { isSelected, ...newLayer } = {
            ...layer,
            image: {
              ...layer.image,
              dataURL,
            },
          };
          json.layers.push(newLayer);
          break;
        case LayerType.Vector:
          {
            const { isSelected, ...newLayer } = {
              ...layer,
            };
            json.layers.push(newLayer);
          }
          break;
        case LayerType.Raster:
          {
            const { isSelected, canvasImage, ...newLayer } = {
              ...layer,
            };
            if (canvasImage != null) {
              const konvaImage = konvaLayer.find("#" + layer.id)[0];
              newLayer.image = {
                dataURL: konvaImage.toDataURL(),
              };
            }
            json.layers.push(newLayer);
          }
          break;
      }
    });
    var dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(json));

    downloadURI(dataStr, "stage.json");
  };

  const handleLoad = async (files: FileList) => {
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

    const reader = new PromiseFileReader();
    const contents = await reader.readAsText(file);
    dispatch({
      type: ActionType.LoadFile,
      contents,
    });
  };

  const handleExportImage = () => {
    const uri = stageRef.current!.toDataURL();
    // we also can save uri as file
    downloadURI(uri, "stage.png");
  };

  const handleImportImageFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith("image/")) {
        continue;
      }

      const fileReader = new PromiseFileReader();
      const dataURL = await fileReader.readAsDataURL(file);
      const layer: ImageLayerProps = createLayer(layers, {
        name: file.name,
        type: LayerType.Image,
        image: {
          id: file.name,
          dataURL,
          x: 0,
          y: 0,
        },
      }) as ImageLayerProps;
      dispatch({
        type: ActionType.ImportImage,
        newLayer: layer,
      });
      setTool(Tool.Move);
    }
  };

  // @todo: Show an error message by the state.statusCode
  let statusMessage;
  switch (state.statusCode) {
    case AppStatusCode.DeleteSelectedLayersNoLayer:
      statusMessage = "Please keep at least one layer";
      break;
    case AppStatusCode.LoadFileInvalidFileFormat:
      statusMessage =
        "Your file is not supported. Please load a file exported from this";
      break;
  }

  const listStyle = {
    display: "inline",
    paddingLeft: 8,
    paddingRight: 8,
    borderRight: "1px solid black",
  };
  return (
    <div>
      <input
        type="file"
        id="importImageFile"
        ref={importFileRef}
        style={{ display: "none" }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          handleImportImageFiles(e.target.files!);
        }}
        data-testid="importImageFile"
      />
      <input
        type="file"
        id="loadFile"
        ref={loadFileRef}
        style={{ display: "none" }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          handleLoad(e.target.files!);
        }}
        data-testid="loadFile"
      />
      {statusMessage != null && (
        <span data-testid="statusMessage" style={{ color: "red" }}>
          {statusMessage}
        </span>
      )}

      <ul style={{ padding: 2, border: "1px solid black" }}>
        <li style={listStyle}>
          <button onClick={handleSave} data-testid="saveButton">
            Save
          </button>
        </li>
        <li style={listStyle}>
          <button
            onClick={() => {
              loadFileRef.current!.click();
            }}
            data-testid="loadButton"
          >
            Load
          </button>
        </li>
        <li style={listStyle}>
          <button onClick={handleExportImage} data-testid="exportImageButton">
            Export an image
          </button>
        </li>
        <li style={listStyle}>
          <button
            onClick={() => {
              importFileRef.current?.click();
            }}
            data-testid="importImageButton"
          >
            Import an image
          </button>
        </li>
        <li style={listStyle}>
          <button
            onClick={() => {
              dispatch({ type: ActionType.Undo });
            }}
            data-testid="undoButton"
          >
            undo
          </button>
        </li>
        <li style={listStyle}>
          <button
            onClick={() => {
              dispatch({ type: ActionType.Redo });
            }}
            data-testid="redoButton"
          >
            redo
          </button>
        </li>
      </ul>

      <ul style={{ padding: 2 }}>
        <li style={listStyle}>
          <input
            type="color"
            value={color}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const colorCode = event.target.value;
              setColor(colorCode);
            }}
            data-testid="colorInput"
          />
        </li>
        <li style={listStyle}>
          <select
            value={tool}
            onChange={(e) => {
              setTool(e.target.value as Tool);
            }}
            data-testid="toolSelect"
          >
            <option value={Tool.Pen}>Pen</option>
            <option value={Tool.Fill}>Fill</option>
            <option value={Tool.Eraser}>Eraser</option>
            <option value={Tool.Move}>Move a layer</option>
          </select>
        </li>
      </ul>

      <ul style={{ display: "block", border: "1px solid black", padding: 2 }}>
        <li style={listStyle}>
          <button
            onClick={() => {
              dispatch({
                type: ActionType.AddLayer,
                layerType: LayerType.Vector,
              });
            }}
            data-testid="addVectorLayerButton"
          >
            Add a vector layer
          </button>
        </li>
        <li style={listStyle}>
          <button
            onClick={() => {
              dispatch({
                type: ActionType.AddLayer,
                layerType: LayerType.Raster,
              });
            }}
            data-testid="addRasterLayerButton"
          >
            Add a raster layer
          </button>
        </li>
        <li style={listStyle}>
          <button
            onClick={() => {
              dispatch({
                type: ActionType.DeleteSelectedLayers,
              });
            }}
            data-testid="deleteSelectedLayersButton"
          >
            Delete select layers
          </button>
        </li>
      </ul>

      <ul
        style={{ borderBottom: "1px solid black", padding: 2 }}
        data-testid="layerList"
      >
        {layers.map((layer, index) => {
          return (
            <li
              key={layer.id}
              style={{
                ...listStyle,
                borderRight: "1px solid black",
              }}
            >
              <input
                data-testid={"layerCheckbox" + index}
                type="checkbox"
                id={layer.id}
                checked={layer.isSelected}
                onChange={() => {
                  dispatch({
                    type: ActionType.SelectLayer,
                    layerId: layer.id,
                  });
                }}
              />
              <label htmlFor={layer.id}>
                {layer.id === currentLayer.id ? (
                  <span style={{ backgroundColor: "orange" }}>
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
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        ref={stageRef}
        style={{ backgroundColor: "rgb(128, 128, 128)" }}
      >
        <Layer>
          {layers.map((layer, index) => {
            switch (layer.type) {
              case LayerType.Vector:
                return (
                  <VectorLayer
                    key={layer.id}
                    {...(layer as VectorLayerProps)}
                  />
                );
              case LayerType.Raster:
                return (
                  <RasterLayer
                    key={layer.id}
                    {...(layer as RasterLayerProps)}
                  />
                );
              case LayerType.Image:
                return (
                  <ImageLayer
                    key={layer.id}
                    draggable={
                      layer.id === currentLayer.id && tool === Tool.Move
                    }
                    setPosition={({ x, y }) => {
                      dispatch({
                        type: ActionType.MoveImageLayer,
                        layerId: layer.id,
                        newPosition: {
                          x,
                          y,
                        },
                      });
                    }}
                    {...(layer as ImageLayerProps)}
                  />
                );
            }
          })}
        </Layer>
      </Stage>
    </div>
  );
}
