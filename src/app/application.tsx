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
  isCurrent: boolean;
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
  history: {
    layers: LayerProps[];
  }[];
  historyIndex: number;
};

enum ActionType {
  ImportImage = "import image",
  Undo = "undo",
  Redo = "redo",
}

type ImportImageAction = {
  type: ActionType.ImportImage;
  newLayer: ImageLayerProps;
};

type AppAction =
  | {
      type: ActionType.Undo;
    }
  | {
      type: ActionType.Redo;
    }
  | ImportImageAction;

function importImageReducer(
  state: AppState,
  action: ImportImageAction
): AppState {
  const newLayers = state.layers.map((layer) => {
    return {
      ...layer,
      isCurrent: false,
    };
  });
  action.newLayer.isCurrent = true;
  let newState: AppState = {
    ...state,
    layers: [...newLayers, action.newLayer],
    historyIndex: state.historyIndex + 1,
  };
  newState.history = [
    ...state.history,
    {
      layers: newState.layers,
    },
  ];
  return newState;
}

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

export default function App() {
  const initialLayers: LayerProps[] = [
    {
      id: "layer-1",
      name: "Layer 1",
      type: LayerType.Vector,
      isCurrent: true,
      isSelected: false,
      lines: [],
    },
  ];
  const [state, dispatch] = React.useReducer<
    (state: AppState, action: AppAction) => AppState
  >(
    (state: AppState, action: AppAction) => {
      switch (action.type) {
        case ActionType.ImportImage:
          return importImageReducer(state, action);
        case ActionType.Undo:
          return undoReducer(state, action);
        case ActionType.Redo:
          return redoReducer(state, action);
      }
    },
    {
      layers: initialLayers,
      history: [{ layers: initialLayers }],
      historyIndex: 0,
    }
  );

  const layers = state.layers;

  // Import
  // https://konvajs.org/docs/react/Images.html
  // https://stackoverflow.com/questions/37457128/react-open-file-browser-on-click-a-div
  const importFileRef = React.useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = React.useState(Tool.Pen);
  const [color] = React.useState("#00ff00");
  const [isDrawing, setIsDrawing] = React.useState(false);

  const currentLayer = layers.filter((layer) => layer.isCurrent)[0];
  const currentLayerIndex = layers.findIndex((layer) => layer.isCurrent);

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

  class AddLayerCommand implements Command {
    layers: LayerProps[];
    newLayer: LayerProps;

    constructor(layers: LayerProps[], newLayer: LayerProps) {
      this.layers = layers.concat();
      this.newLayer = newLayer;
    }

    undo() {
      setLayers([...this.layers]);
    }

    run() {
      setLayers([...this.layers, this.newLayer]);
    }
  }

  const createLayer = (
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
      isCurrent: false,
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

  const handleAddLayer = (layerType: LayerType) => {
    let newLayer: LayerProps = createLayer({
      type: layerType,
    });

    const command = new AddLayerCommand(layers, newLayer);
    addToHistory(command);
    command.run();
  };

  class DeleteSelectedLayersCommand implements Command {
    layers: LayerProps[];
    newLayers: LayerProps[];

    constructor(layers: LayerProps[], newLayers: LayerProps[]) {
      this.layers = layers.concat();
      this.newLayers = newLayers.concat();
    }

    undo() {
      setLayers([...this.layers]);
    }

    run() {
      if (
        this.newLayers.filter((layer) => layer.id === currentLayer.id)
          .length === 0
      ) {
        let newLayers = this.newLayers.concat();
        newLayers[0].isCurrent = true;
        setLayers([...newLayers]);
      } else {
        setLayers([...this.newLayers]);
      }
    }
  }

  const handleDeleteSelectedLayers = () => {
    const selectedLayers = layers.filter((layer) => layer.isSelected);
    if (selectedLayers.length === 0) {
      return;
    }

    const newLayers = layers.filter((layer) => !layer.isSelected);
    if (selectedLayers.length === 0) {
      return;
    }

    const command = new DeleteSelectedLayersCommand(layers, newLayers);
    addToHistory(command);
    command.run();
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
      const layer: ImageLayerProps = createLayer({
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

  class MoveCommand implements Command {
    layerIndex: number;
    position: {
      x: number;
      y: number;
    };
    originalPosition: {
      x: number;
      y: number;
    };

    constructor(
      layerIndex: number,
      { x, y }: { x: number; y: number },
      originalPosition: { x: number; y: number }
    ) {
      this.layerIndex = layerIndex;
      this.position = { x, y };
      this.originalPosition = originalPosition;
    }

    run() {
      const imageLayer = layers[this.layerIndex] as ImageLayerProps;
      imageLayer.image.x = this.position.x;
      imageLayer.image.y = this.position.y;
      setLayers([...layers]);
    }

    undo() {
      const imageLayer = layers[this.layerIndex] as ImageLayerProps;
      imageLayer.image.x = this.originalPosition.x;
      imageLayer.image.y = this.originalPosition.y;
      setLayers([...layers]);
    }
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
              handleAddLayer(LayerType.Vector);
            }}
          >
            Add a vector layer
          </button>
        </li>
        <li style={{ display: "inline-block" }}>
          <button onClick={handleDeleteSelectedLayers}>
            Delete select layers
          </button>
        </li>
      </ul>

      <ul style={{ padding: 2 }}>
        {layers.map((layer, index) => {
          return (
            <li key={layer.id} style={{ padding: 2 }}>
              <input
                type="checkbox"
                id={layer.id}
                checked={layer.isSelected}
                onChange={() => {
                  layers.forEach((layer, j) => {
                    if (index === j) {
                      layers[index].isCurrent = true;
                    } else {
                      layers[j].isCurrent = false;
                    }
                  });
                  layers[index].isSelected = !layers[index].isSelected;
                  setLayers([...layers]);
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
                    draggable={layer.isCurrent && tool === Tool.Move}
                    setPosition={({ x, y }) => {
                      const imageLayer = layer as ImageLayerProps;
                      const originalPosition = {
                        x: imageLayer.image.x,
                        y: imageLayer.image.y,
                      };
                      const command = new MoveCommand(
                        index,
                        { x, y },
                        originalPosition
                      );
                      command.run();
                      addToHistory(command);
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
