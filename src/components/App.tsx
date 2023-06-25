import Konva from "konva";
import React from "react";
import { Stage, Layer, Line, Text, Group, Image } from "react-konva";
import useImage from "use-image";
import {
  ActionType,
  AppAction,
  AppState,
  AppStatusCode,
  Color,
  ImageLayerProps,
  LayerType,
  MouseEventType,
  Tool,
  VectorLayerProps,
  appReducer,
  createLayer,
  initialState,
} from "./AppReducer";

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
  // Import
  // https://konvajs.org/docs/react/Images.html
  // https://stackoverflow.com/questions/37457128/react-open-file-browser-on-click-a-div
  const importFileRef = React.useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = React.useState(Tool.Pen);
  const [color] = React.useState<Color>("#00ff00");

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const point = e.target.getStage()!.getPointerPosition()!;
    dispatch({
      type: ActionType.DrawOnCanvas,
      mouseEventType: MouseEventType.Down,
      color: color,
      tool: tool,
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
  }

  return (
    <div>
      <input
        type="file"
        id="file"
        ref={importFileRef}
        style={{ display: "none" }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          handleImportImageFiles(e.target.files!);
        }}
        data-testid="importImageFile"
      />
      {statusMessage != null && (
        <span data-testid="statusMessage">{statusMessage}</span>
      )}

      <ul style={{ display: "inline-block" }}>
        <li style={{ display: "inline", padding: 2 }}>
          <button onClick={handleExportImage} data-testid="exportImageButton">
            Export an image
          </button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <button
            onClick={() => {
              importFileRef.current?.click();
            }}
            data-testid="importImageButton"
          >
            Import an image
          </button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <select
            value={tool}
            onChange={(e) => {
              setTool(e.target.value as Tool);
            }}
            data-testid="toolSelect"
          >
            <option value={Tool.Pen}>Pen</option>
            <option value={Tool.Eraser}>Eraser</option>
            <option value={Tool.Move}>Move a layer</option>
          </select>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <button
            onClick={() => {
              dispatch({ type: ActionType.Undo });
            }}
            data-testid="undoButton"
          >
            undo
          </button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
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

      <ul style={{ display: "block" }}>
        <li style={{ display: "inline-block" }}>
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
        <li style={{ display: "inline-block" }}>
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

      <ul style={{ padding: 2 }} data-testid="layerList">
        {layers.map((layer, index) => {
          return (
            <li key={layer.id} style={{ padding: 2 }}>
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
          <Text text="Just start drawing" x={5} y={30} />
          {layers.map((layer, index) => {
            switch (layer.type) {
              case LayerType.Vector:
                return (
                  <VectorLayer
                    key={layer.id}
                    {...(layer as VectorLayerProps)}
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
