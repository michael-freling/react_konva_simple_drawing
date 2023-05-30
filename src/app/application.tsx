import Konva from "konva";
import React from "react";
import { Stage, Layer, Line, Text, Group, Image } from "react-konva";
import useImage from "use-image";

enum Tool {
  Pen = "pen",
  Eraser = "eraser",
  Move = "Move",
}

enum LayerType {
  Vector = "vector",
  Image = "image",
}

type BaseLayerProps = {
  id: string;
  name: string;
  type: LayerType;
  isSelected: boolean;
};

type FreeDrawLine = {
  tool: Tool;
  color: string;
  points: number[];
};

type VectorLayerProps = BaseLayerProps & {
  type: LayerType.Vector;
  lines: FreeDrawLine[];
};

type ImageLayerProps = BaseLayerProps & {
  type: LayerType.Image;
  image: {
    id: string;
    dataURL: string;
    x: number;
    y: number;
  };
};

type LayerProps = VectorLayerProps | ImageLayerProps;

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
      alt=""
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

interface Command {
  run(): void;
  undo(): void;
}

type AppState = {
  layers: LayerProps[];
  currentLayerIndex: number;
  history: {
    layers: LayerProps[];
    currentLayerIndex: number;
  }[];
  historyIndex: number;
};

enum ActionType {
  Undo = "undo",
  Redo = "redo",
  AddLayer = "add layer",
  SelectLayer = "select layer",
  DeleteSelectedLayers = "delete layer",
  ImportImage = "import image",
  MoveImageLayer = "move image layer",
}

type ImportImageAction = {
  type: ActionType.ImportImage;
  newLayer: ImageLayerProps;
};

type MoveImageLayerAction = {
  type: ActionType.MoveImageLayer;
  layerId: string;
  newPosition: {
    x: number;
    y: number;
  };
};

type AddLayerAction = {
  type: ActionType.AddLayer;
  layerType: LayerType;
};

type SelectLayerAction = {
  type: ActionType.SelectLayer;
  layerId: string;
};
type DeleteSelectedLayersAction = {
  type: ActionType.DeleteSelectedLayers;
};

type AppAction =
  | {
      type: ActionType.Undo;
    }
  | {
      type: ActionType.Redo;
    }
  | ImportImageAction
  | AddLayerAction
  | SelectLayerAction
  | DeleteSelectedLayersAction
  | MoveImageLayerAction;

function undoReducer(state: AppState, action: AppAction): AppState {
  if (state.historyIndex <= 0) {
    return state;
  }

  const historyIndex = state.historyIndex - 1;
  const previousState = state.history[historyIndex];
  return {
    ...state,
    layers: previousState.layers,
    historyIndex,
  };
}

function redoReducer(state: AppState, action: AppAction): AppState {
  if (state.historyIndex + 1 >= state.history.length) {
    return state;
  }

  const historyIndex = state.historyIndex + 1;
  const nextState = state.history[historyIndex];
  return {
    ...state,
    layers: nextState.layers,
    historyIndex,
  };
}

// https://stackoverflow.com/questions/48230773/how-to-create-a-partial-like-that-requires-a-single-property-to-be-set
type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;

function addStateToHistory(
  previousState: AppState,
  newState: AtLeast<AppState, "layers">
): AppState {
  let currentLayerIndex = previousState.currentLayerIndex;
  if (newState.currentLayerIndex != null) {
    currentLayerIndex = newState.currentLayerIndex;
  }

  return {
    ...previousState,
    ...newState,
    history: [
      ...previousState.history,
      {
        layers: newState.layers,
        currentLayerIndex,
      },
    ],
    historyIndex: previousState.historyIndex + 1,
  };
}

const createLayer = (
  layers: LayerProps[],
  props: Partial<LayerProps> & {
    type: LayerType;
  }
): LayerProps => {
  const layerId = "layer-" + (layers.length + 1);
  const name = "Layer " + (layers.length + 1);
  const defaultProps = {
    id: layerId,
    name,
    isSelected: false,
  };
  switch (props.type) {
    case LayerType.Vector:
      return {
        ...defaultProps,
        lines: [],
        ...props,
      } as VectorLayerProps;
    case LayerType.Image:
      return {
        ...defaultProps,
        image: {},
        ...props,
      } as ImageLayerProps;
  }
};

function addLayerReducer(state: AppState, action: AddLayerAction): AppState {
  const newLayer = createLayer(state.layers, {
    type: action.layerType,
  });

  return addStateToHistory(state, {
    layers: [...state.layers, newLayer],
  });
}

function selectLayerReducer(
  state: AppState,
  action: SelectLayerAction
): AppState {
  const index = state.layers.findIndex((layer) => layer.id === action.layerId);
  state.layers[index].isSelected = !state.layers[index].isSelected;
  return {
    ...state,
    layers: state.layers,
    currentLayerIndex: index,
  };
}

function deleteSelectedLayersReducer(
  state: AppState,
  action: DeleteSelectedLayersAction
): AppState {
  const layers = state.layers;
  const selectedLayers = layers.filter((layer) => layer.isSelected);
  if (selectedLayers.length === 0) {
    return state;
  }

  const newLayers = layers.filter((layer) => !layer.isSelected);
  if (selectedLayers.length === 0) {
    return state;
  }

  const currentLayer = layers[state.currentLayerIndex];
  let currentLayerIndex = state.currentLayerIndex;
  if (newLayers.filter((layer) => layer.id === currentLayer.id).length === 0) {
    currentLayerIndex = 0;
  }

  return addStateToHistory(state, {
    layers: newLayers,
    currentLayerIndex: 0,
  });
}

function importImageReducer(
  state: AppState,
  action: ImportImageAction
): AppState {
  return addStateToHistory(state, {
    layers: [...state.layers, action.newLayer],
    currentLayerIndex: state.layers.length,
  });
}

function MoveImageLayerReducer(
  state: AppState,
  action: MoveImageLayerAction
): AppState {
  const layerIndex = state.layers.findIndex(
    (layer) => layer.id === action.layerId
  );

  if (layerIndex === -1) {
    return state;
  }

  const newLayer = {
    ...state.layers[layerIndex],
    image: {
      ...(state.layers[layerIndex] as ImageLayerProps).image,
      ...action.newPosition,
    },
  } as ImageLayerProps;

  return addStateToHistory(state, {
    layers: [
      ...state.layers.slice(0, layerIndex),
      newLayer,
      ...state.layers.slice(layerIndex + 1, state.layers.length),
    ],
  });
}

export default function App() {
  const initialLayers: LayerProps[] = [
    {
      id: "layer-1",
      name: "Layer 1",
      type: LayerType.Vector,
      isSelected: false,
      lines: [],
    },
  ];
  const [state, dispatch] = React.useReducer<
    (state: AppState, action: AppAction) => AppState
  >(
    (state: AppState, action: AppAction) => {
      // TODO: Replace these switch case with a factory method
      // by figuring out how to define signatures for different compatible types in TypeScript
      switch (action.type) {
        // no need to undo
        case ActionType.Undo:
          return undoReducer(state, action);
        case ActionType.Redo:
          return redoReducer(state, action);
        case ActionType.SelectLayer:
          return selectLayerReducer(state, action);

        // need to undo and redo
        case ActionType.ImportImage:
          return importImageReducer(state, action);
        case ActionType.AddLayer:
          return addLayerReducer(state, action);
        case ActionType.DeleteSelectedLayers:
          return deleteSelectedLayersReducer(state, action);
        case ActionType.MoveImageLayer:
          return MoveImageLayerReducer(state, action);
      }
    },
    {
      layers: initialLayers,
      currentLayerIndex: 0,
      history: [
        {
          layers: initialLayers,
          currentLayerIndex: 0,
        },
      ],
      historyIndex: 0,
    }
  );

  const layers = state.layers;
  const currentLayer = layers[state.currentLayerIndex];
  const currentLayerIndex = state.currentLayerIndex;

  // Import
  // https://konvajs.org/docs/react/Images.html
  // https://stackoverflow.com/questions/37457128/react-open-file-browser-on-click-a-div
  const importFileRef = React.useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = React.useState(Tool.Pen);
  const [color] = React.useState("#00ff00");
  const [isDrawing, setIsDrawing] = React.useState(false);

  class FreeDrawCommand implements Command {
    layerIndex: number;
    lines: FreeDrawLine[];

    constructor(layerIndex: number, lines: FreeDrawLine[]) {
      this.layerIndex = layerIndex;
      this.lines = lines.concat();
    }

    getLayer(): VectorLayerProps {
      const layer = layers[this.layerIndex];
      if (layer.type !== LayerType.Vector) {
        throw new Error("Unsupported layer for free draw");
      }
      return layer;
    }

    undo() {
      const layer = this.getLayer();
      layer.lines = layer.lines.slice(0, this.lines.length - 1);
      layers[this.layerIndex] = layer;
      setLayers([...layers]);
    }

    run() {
      const layer = this.getLayer();
      layer.lines = this.lines;
      layers[this.layerIndex] = layer;
      setLayers([...layers]);
    }
  }

  const addToHistory = (newCommand: Command) => {
    setHistory([...history, newCommand]);
    setHistoryIndex(historyIndex + 1);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== Tool.Pen && tool !== Tool.Eraser) {
      return;
    }
    if (currentLayer.type === LayerType.Image) {
      return;
    }

    setIsDrawing(true);
    const point = e.target.getStage()!.getPointerPosition()!;

    currentLayer.lines.push({
      tool,
      color,
      points: [point.x, point.y],
    });
    layers[currentLayerIndex] = currentLayer;
    setLayers([...layers]);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== Tool.Pen && tool !== Tool.Eraser) {
      return;
    }
    if (currentLayer.type === LayerType.Image) {
      return;
    }

    // no drawing - skipping
    if (!isDrawing) {
      return;
    }

    const point = e.target.getStage()!.getPointerPosition()!;

    const lines = currentLayer.lines;
    let lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);

    lines.splice(lines.length - 1, 1, lastLine);
    currentLayer.lines = lines;
    layers[currentLayerIndex] = currentLayer;
    setLayers([...layers]);
  };

  const handleMouseUp = () => {
    if (tool !== Tool.Pen && tool !== Tool.Eraser) {
      return;
    }
    if (currentLayer.type === LayerType.Image) {
      return;
    }

    setIsDrawing(false);
    addToHistory(new FreeDrawCommand(currentLayerIndex, currentLayer.lines));
  };

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
        this.fileReader.readAsDataURL(file);
      });
    }
  }

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
      />

      <ul style={{ display: "inline-block" }}>
        <li style={{ display: "inline", padding: 2 }}>
          <button
            onClick={() => {
              importFileRef.current?.click();
            }}
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
          >
            undo
          </button>
        </li>
        <li style={{ display: "inline", padding: 2 }}>
          <button
            onClick={() => {
              dispatch({ type: ActionType.Redo });
            }}
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
          >
            Delete select layers
          </button>
        </li>
      </ul>

      <ul style={{ padding: 2 }}>
        {layers.map((layer) => {
          return (
            <li key={layer.id} style={{ padding: 2 }}>
              <input
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
