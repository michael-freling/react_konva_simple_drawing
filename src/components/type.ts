export type AppState = {
  layers: Layer[];
  setLayers: (layers: Layer[]) => void;
  currentLayerId: string;
  setCurrentLayerId: (layerId: string) => void;
};

export enum Tool {
  Pen = "pen",
  Eraser = "eraser",
  Move = "move",
  Fill = "fill",
}

export enum Operation {
  FreeDraw = "draw",
  Erase = "erase",
  Drag = "drag",
  Import = "import",
  Fill = "fill",
  AddLayer = "add_layer",
  DeleteSelectedLayers = "delete_selected_layers",
}

export enum LayerType {
  Vector = "vector",
  Raster = "raster",
  Image = "image",
}

export type Layer = {
  id: string;
  name: string;
  selected: boolean;
  deleted: boolean; // for undo/redo
  isInitialLayer: boolean;
  type: LayerType;
};

// TODO: Rename OperationType to Command later
export interface OperationType {
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
  fillImageData?: HTMLImageElement;
  layers?: string[];

  run?: (state: AppState) => void;
  undo?: (state: AppState) => void;
}
