import { newAddLayerCommand } from "./layer";

describe("newAddLayerCommand", () => {
  const defaultCurrentLayerId = "initial-layer";

  const runCases = [
    {
      name: "empty layers",
      layers: [],
      newLayer: {
        id: "layer-2",
      },
      currentLayerId: defaultCurrentLayerId,
      expected: [
        {
          id: "layer-2",
        },
      ],
    },
    {
      name: "Add a second layer",
      layers: [
        {
          id: defaultCurrentLayerId,
        },
      ],
      newLayer: {
        id: "layer-2",
      },
      currentLayerId: defaultCurrentLayerId,
      expected: [
        {
          id: "layer-2",
        },
        {
          id: defaultCurrentLayerId,
        },
      ],
    },
    {
      name: "Add a layer above the current layer",
      layers: [
        {
          id: "layer-2",
        },
        {
          id: defaultCurrentLayerId,
        },
      ],
      newLayer: {
        id: "layer-3",
      },
      currentLayerId: defaultCurrentLayerId,
      expected: [
        {
          id: "layer-2",
        },
        {
          id: "layer-3",
        },
        {
          id: defaultCurrentLayerId,
        },
      ],
    },
  ];
  test.each(runCases)(
    "$name",
    ({ layers, newLayer, currentLayerId, expected }) => {
      const command = newAddLayerCommand(newLayer, currentLayerId);
      command.run({
        layers,
        setLayers: (actual) => {
          expect(actual).toEqual(expected);
        },
      });

      command.undo({
        layers: expected,
        setLayers: (actual) => {
          if (layers.length > 0) {
            expect(actual).toEqual(layers);
            return;
          }
          throw new Error("should't be called");
        },
        setCurrentLayerId: (actual) => {
          if (layers.length > 0) {
            expect(actual).toEqual(currentLayerId);
            return;
          }
          throw new Error("should't be called");
        },
      });
    }
  );
});
