import { newAddLayerCommand, newDeleteSelectedLayersCommand } from "./layer";

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

describe("newDeleteSelectedLayersCommand", () => {
  const defaultCurrentLayerId = "initial-layer";

  const runCases = [
    {
      name: "Delete one layer",
      layers: [
        {
          id: defaultCurrentLayerId,
          selected: true,
        },
        {
          id: "layer-2",
        },
      ],
      currentLayerId: defaultCurrentLayerId,
      expectedLayers: [
        {
          id: "layer-2",
        },
      ],
      expectedCurrentLayerId: "layer-2",
    },
    {
      name: "Delete multiple layers",
      layers: [
        {
          id: "layer-3",
          selected: true,
        },
        {
          id: "layer-2",
        },
        {
          id: defaultCurrentLayerId,
          selected: true,
        },
      ],
      currentLayerId: defaultCurrentLayerId,
      expectedLayers: [
        {
          id: "layer-2",
        },
      ],
      expectedCurrentLayerId: "layer-2",
    },
    {
      name: "a deleted layer isn't the current layer",
      layers: [
        {
          id: "layer-3",
          selected: true,
        },
        {
          id: defaultCurrentLayerId,
        },
        {
          id: "layer-2",
          selected: true,
        },
      ],
      currentLayerId: defaultCurrentLayerId,
      expectedLayers: [
        {
          id: defaultCurrentLayerId,
        },
      ],
      expectedCurrentLayerId: defaultCurrentLayerId,
    },
  ];
  test.each(runCases)(
    "$name",
    ({ layers, currentLayerId, expectedLayers, expectedCurrentLayerId }) => {
      const command = newDeleteSelectedLayersCommand(layers);
      command.run({
        currentLayerId,
        setCurrentLayerId: (actual) => {
          expect(actual).toEqual(expectedCurrentLayerId);
        },
        setLayers: (actual) => {
          expect(actual).toEqual(expectedLayers);
        },
      });

      command.undo({
        setLayers: (actual) => {
          expect(actual).toEqual(layers);
        },
      });
    }
  );

  test.each([
    {
      name: "empty layers",
      layers: [],
    },
    {
      name: "no layer was selected",
      layers: [
        {
          id: defaultCurrentLayerId,
        },
      ],
    },
    {
      name: "no layer would exist",
      layers: [
        {
          id: defaultCurrentLayerId,
          selected: true,
        },
      ],
    },
  ])("$name", ({ layers }) => {
    expect(() => {
      const command = newDeleteSelectedLayersCommand(layers);
      command.run();
    }).toThrow(Error);
  });
});
