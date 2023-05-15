import { AppState, Layer, LayerType, Operation, OperationType } from "./type";

export const newLayer = ({
  name,
  type,
  layers,
}: {
  name: string;
  type: LayerType;
  layers: Layer[];
}): Layer => {
  const layerId = "layer-" + (layers.length + 1);
  return {
    id: layerId,
    selected: false,
    isInitialLayer: false,
    name,
    type,
  };
};

export function newAddLayerCommand(
  newLayer: Layer,
  currentLayerId: string
): OperationType & {
  run: (state: AppState) => void;
} {
  return new AddLayerCommand(newLayer, currentLayerId);
}

class AddLayerCommand implements OperationType {
  operation: Operation = Operation.AddLayer;
  newLayer: Layer;
  currentLayerId: string;

  constructor(newLayer: Layer, currentLayerId: string) {
    this.newLayer = newLayer;
    this.currentLayerId = currentLayerId;
  }

  run({ layers, setLayers }: AppState): void {
    let currentLayerIndex = layers.length;
    layers.forEach((layer, index) => {
      if (layer.id !== this.currentLayerId) {
        return;
      }

      currentLayerIndex = index;
    });

    let result = layers.slice(0, currentLayerIndex);
    result.push(this.newLayer);
    const remainingLayers = layers.slice(currentLayerIndex);
    if (remainingLayers.length > 0) {
      result = result.concat(remainingLayers);
    }
    setLayers(result);
  }

  undo({ layers, setLayers, setCurrentLayerId }: AppState): void {
    if (layers.length <= 1) {
      return;
    }

    let result = layers;
    let addedLayerIndex = layers.length;

    layers.forEach((layer, index) => {
      if (layer.id !== this.newLayer.id) {
        return;
      }

      addedLayerIndex = index;
    });
    if (addedLayerIndex !== layers.length) {
      result = layers
        .slice(0, addedLayerIndex)
        .concat(layers.slice(addedLayerIndex + 1));
    }
    setLayers(result);
    setCurrentLayerId(this.currentLayerId);
  }
}

export function newDeleteSelectedLayersCommand(
  layers: Layer[]
): DeleteSelectedLayersCommand {
  return new DeleteSelectedLayersCommand(layers);
}

class DeleteSelectedLayersCommand implements OperationType {
  operation = Operation.DeleteSelectedLayers;

  selectedLayers: Layer[];
  newLayers: Layer[];
  originalLayers: Layer[];

  constructor(layers: Layer[]) {
    this.originalLayers = [...layers];

    let newLayers: Layer[] = [];
    let selectedLayers: Layer[] = [];
    layers.forEach((layer) => {
      if (layer.selected) {
        selectedLayers.push(layer);
      } else {
        newLayers.push(layer);
      }
    });
    this.newLayers = newLayers;
    this.selectedLayers = selectedLayers;
  }

  run({ setLayers, currentLayerId, setCurrentLayerId }: AppState) {
    if (this.newLayers.length === 0 || this.selectedLayers.length === 0) {
      throw new Error("Prerequisite check error");
    }

    setLayers(this.newLayers);

    const isCurrentLayerDeleted =
      this.newLayers.filter((layer) => layer.id === currentLayerId).length ===
      0;
    if (isCurrentLayerDeleted) {
      setCurrentLayerId(this.newLayers[0].id);
    }
  }

  undo({ setLayers }: AppState): void {
    if (this.newLayers.length === 0 || this.selectedLayers.length === 0) {
      throw new Error("Prerequisite check error");
    }

    setLayers([...this.originalLayers]);
  }
}
