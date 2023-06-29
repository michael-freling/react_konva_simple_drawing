import { AtLeast, assert } from "./util";

export type Color = string;

export enum Tool {
  Pen = "pen",
  Eraser = "eraser",
  Move = "Move",
}

export enum LayerType {
  Vector = "vector",
  Image = "image",
}

type BaseLayerProps = {
  id: string;
  name: string;
  type: LayerType;
  isSelected: boolean;
};

export type VectorLayerProps = BaseLayerProps & {
  type: LayerType.Vector;
  lines: FreeDrawLine[];
};

export type ImageLayerProps = BaseLayerProps & {
  type: LayerType.Image;
  image: {
    id: string;
    dataURL: string;
    x: number;
    y: number;
  };
};

export type LayerProps = VectorLayerProps | ImageLayerProps;

type FreeDrawLine = {
  tool: Tool;
  color: Color;
  points: number[];
};

export type AppState = {
  layers: LayerProps[];
  currentLayerIndex: number;
  history: {
    layers: LayerProps[];
    currentLayerIndex: number;
  }[];
  historyIndex: number;
  isDrawing: boolean;
  statusCode?: AppStatusCode;
};

export enum ActionType {
  Undo = "undo",
  Redo = "redo",
  AddLayer = "add layer",
  SelectLayer = "select layer",
  DeleteSelectedLayers = "delete layer",
  LoadFile = "load a file",
  ImportImage = "import image",
  MoveImageLayer = "move image layer",
  DrawOnCanvas = "draw on canvas",
}

export type Drawing = {
  layers: LayerProps[];
};

export type LoadFileAction = {
  type: ActionType.LoadFile;
  contents: string;
};

export type ImportImageAction = {
  type: ActionType.ImportImage;
  newLayer: ImageLayerProps;
};

export type MoveImageLayerAction = {
  type: ActionType.MoveImageLayer;
  layerId: string;
  newPosition: {
    x: number;
    y: number;
  };
};

export type AddLayerAction = {
  type: ActionType.AddLayer;
  layerType: LayerType;
};

export type SelectLayerAction = {
  type: ActionType.SelectLayer;
  layerId: string;
};
type DeleteSelectedLayersAction = {
  type: ActionType.DeleteSelectedLayers;
};

export enum MouseEventType {
  Up = "Up",
  Down = "Down",
  Move = "Move",
}

export type FreeDrawAction = {
  type: ActionType.DrawOnCanvas;
  mouseEventType: MouseEventType;
  tool: Tool;
  color: Color;

  point: {
    x: number;
    y: number;
  };
};

export type AppAction =
  | {
      type: ActionType.Undo;
    }
  | {
      type: ActionType.Redo;
    }
  | LoadFileAction
  | ImportImageAction
  | AddLayerAction
  | SelectLayerAction
  | DeleteSelectedLayersAction
  | MoveImageLayerAction
  | FreeDrawAction;

export enum AppStatusCode {
  LoadFileInvalidFileFormat = "LoadFileInvalidFileFormat",
  DeleteSelectedLayersNoLayer = "DeleteSelectedLayersNoLayer",
  MoveImageLayerInvalidLayerId = "MoveImageLayerInvalidLayerId",
  MoveImageLayerInvalidLayerType = "MoveImageLayerInvalidLayerType",
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
    currentLayerIndex: previousState.currentLayerIndex,
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
    currentLayerIndex: nextState.currentLayerIndex,
    historyIndex,
  };
}

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
    currentLayerIndex,
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

export function createLayer(
  layers: LayerProps[],
  props: Partial<LayerProps> & {
    type: LayerType;
  }
): LayerProps {
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
}

function addLayerReducer(state: AppState, action: AddLayerAction): AppState {
  if (action.layerType === LayerType.Image) {
    // TODO error
    return state;
  }

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
  assert(index !== -1, "the selected layer does not exist", action);

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
  if (newLayers.length === 0) {
    return {
      ...state,
      statusCode: AppStatusCode.DeleteSelectedLayersNoLayer,
    };
  }

  const currentLayer = layers[state.currentLayerIndex];
  let currentLayerIndex = newLayers.findIndex(
    (layer) => layer.id === currentLayer.id
  );
  if (currentLayerIndex === -1) {
    currentLayerIndex = 0;
  }

  return addStateToHistory(state, {
    layers: newLayers,
    currentLayerIndex,
  });
}

function loadFileReducer(state: AppState, action: LoadFileAction): AppState {
  try {
    const jsonContents = JSON.parse(action.contents);
    if (jsonContents.layers == null) {
      return {
        ...state,
        statusCode: AppStatusCode.LoadFileInvalidFileFormat,
      };
    }
    if (jsonContents.layers.length == null || jsonContents.layers.length == 0) {
      return {
        ...state,
        statusCode: AppStatusCode.LoadFileInvalidFileFormat,
      };
    }

    return addStateToHistory(state, {
      layers: jsonContents.layers,
      currentLayerIndex: 0,
    });
  } catch (error) {
    return {
      ...state,
      statusCode: AppStatusCode.LoadFileInvalidFileFormat,
    };
  }
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

function moveImageLayerReducer(
  state: AppState,
  action: MoveImageLayerAction
): AppState {
  const layerIndex = state.layers.findIndex(
    (layer) => layer.id === action.layerId
  );

  if (layerIndex === -1) {
    return {
      ...state,
      statusCode: AppStatusCode.MoveImageLayerInvalidLayerId,
    };
  }
  const layer = state.layers[layerIndex];
  if (layer.type !== LayerType.Image) {
    return {
      ...state,
      statusCode: AppStatusCode.MoveImageLayerInvalidLayerType,
    };
  }

  const newLayer = {
    ...layer,
    image: {
      ...(layer as ImageLayerProps).image,
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

function drawReducer(state: AppState, action: FreeDrawAction): AppState {
  // TODO: improve performance
  let newState = JSON.parse(JSON.stringify(state));
  const currentLayer = newState.layers[newState.currentLayerIndex];

  switch (action.tool) {
    case Tool.Pen:
    case Tool.Eraser:
      if (currentLayer.type !== LayerType.Vector) {
        return state;
      }

      switch (action.mouseEventType) {
        case MouseEventType.Down:
          newState.isDrawing = true;
          (currentLayer as VectorLayerProps).lines.push({
            tool: action.tool,
            color: action.color,
            points: [action.point.x, action.point.y],
          });
          return newState;

        case MouseEventType.Up:
          if (!state.isDrawing) {
            return state;
          }

          return addStateToHistory(state, {
            layers: newState.layers,
            isDrawing: false,
          });

        case MouseEventType.Move:
          if (!state.isDrawing) {
            return state;
          }

          const lines = currentLayer.lines;
          let lastLine = lines[lines.length - 1];
          lastLine.points = lastLine.points.concat([
            action.point.x,
            action.point.y,
          ]);
          lines.splice(lines.length - 1, 1, lastLine);
          currentLayer.lines = lines;
          newState.layers[state.currentLayerIndex] = currentLayer;
          return newState;
      }

    case Tool.Move:
      // TODO
      switch (action.mouseEventType) {
        case MouseEventType.Down:

        case MouseEventType.Up:

        case MouseEventType.Move:
      }
  }

  return state;
}

export function appReducer(state: AppState, action: AppAction): AppState {
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
    case ActionType.LoadFile:
      return loadFileReducer(state, action);
    case ActionType.ImportImage:
      return importImageReducer(state, action);
    case ActionType.AddLayer:
      return addLayerReducer(state, action);
    case ActionType.DeleteSelectedLayers:
      return deleteSelectedLayersReducer(state, action);
    case ActionType.MoveImageLayer:
      return moveImageLayerReducer(state, action);
    case ActionType.DrawOnCanvas:
      return drawReducer(state, action);
  }
}

const initialLayers: LayerProps[] = [
  {
    id: "layer-1",
    name: "Layer 1",
    type: LayerType.Vector,
    isSelected: false,
    lines: [],
  },
];

export const initialState: AppState = {
  layers: initialLayers,
  currentLayerIndex: 0,
  history: [
    {
      layers: initialLayers,
      currentLayerIndex: 0,
    },
  ],
  historyIndex: 0,
  isDrawing: false,
};
