import { AppState, Layer, Operation, OperationType } from "./type";

export function newAddLayerCommand(
  newLayer: Layer,
  currentLayerId: string
): OperationType & {
  run: (state: AppState) => void;
  undo: (state: AppState) => void;
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

  run({ layers, setLayers }: AppState) {
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
