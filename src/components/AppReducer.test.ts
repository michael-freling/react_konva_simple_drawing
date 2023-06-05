import {
  ActionType,
  AddLayerAction,
  AppState,
  AppStatusCode,
  FreeDrawAction,
  ImportImageAction,
  LayerProps,
  LayerType,
  MouseEventType,
  MoveImageLayerAction,
  SelectLayerAction,
  Tool,
  VectorLayerProps,
  appReducer,
  initialState,
} from "./AppReducer";

function createState({
  state,
  layers,
  currentLayerIndex,
}: {
  state: AppState;
  layers: LayerProps[];
  currentLayerIndex?: number;
}) {
  if (currentLayerIndex == null) {
    currentLayerIndex = state.currentLayerIndex;
  }

  return {
    ...state,
    layers,
    currentLayerIndex,
    historyIndex: state.historyIndex + 1,
    history: [
      ...state.history,
      {
        layers,
        currentLayerIndex,
      },
    ],
  };
}

describe("AppReducer actions", () => {
  const testVectorLayer: LayerProps = {
    id: "new",
    type: LayerType.Vector,
    isSelected: false,
    name: "new layer",
    lines: [{ tool: Tool.Pen, color: "#000000", points: [0, 0] }],
  };

  const nextState: AppState = {
    isDrawing: false,
    layers: [...initialState.layers, testVectorLayer],
    currentLayerIndex: 1,
    history: [
      ...initialState.history,
      {
        layers: [...initialState.layers, testVectorLayer],
        currentLayerIndex: 1,
      },
    ],
    historyIndex: 1,
  };

  describe(ActionType.Undo.toString(), () => {
    const testCases: {
      name: string;
      state: AppState;
      expected: AppState;
    }[] = [
      {
        name: "initial state: undo isn't possible",
        state: initialState,
        expected: initialState,
      },
      {
        name: "undo to the initial state",
        state: {
          isDrawing: false,
          layers: [...initialState.layers, testVectorLayer],
          currentLayerIndex: 1,
          history: [
            ...initialState.history,
            {
              layers: [...initialState.layers, testVectorLayer],
              currentLayerIndex: 1,
            },
          ],
          historyIndex: 1,
        },
        expected: {
          ...initialState,
          history: [
            ...initialState.history,
            {
              layers: [...initialState.layers, testVectorLayer],
              currentLayerIndex: 1,
            },
          ],
          historyIndex: 0,
        },
      },
    ];

    test.each(testCases)("$name", ({ state, expected }) => {
      const got = appReducer(state, {
        type: ActionType.Undo,
      });
      expect(got).toEqual(expected);
    });
  });

  describe(ActionType.Redo.toString(), () => {
    const testCases: {
      name: string;
      state: AppState;
      expected: AppState;
    }[] = [
      {
        name: "initial state: redo isn't possible",
        state: initialState,
        expected: initialState,
      },
      {
        name: "redo to the test state",
        state: {
          ...nextState,
          layers: initialState.layers,
          currentLayerIndex: 0,
          historyIndex: 0,
        },
        expected: nextState,
      },
      {
        name: "redo isn't possible if no more history",
        state: nextState,
        expected: nextState,
      },
    ];
    test.each(testCases)("$name", ({ state, expected }) => {
      const got = appReducer(state, {
        type: ActionType.Redo,
      });
      expect(got).toEqual(expected);
    });
  });

  describe(ActionType.SelectLayer.toString(), () => {
    const testCases: {
      name: string;
      state: AppState;
      actionPayload: Omit<SelectLayerAction, "type">;
      expected: AppState;
    }[] = [
      {
        name: "select the current selected layer",
        state: initialState,
        actionPayload: {
          layerId: initialState.layers[initialState.currentLayerIndex].id,
        },
        expected: initialState,
      },
      {
        name: "select non selected layer ",
        state: nextState,
        actionPayload: {
          layerId: initialState.layers[initialState.currentLayerIndex].id,
        },
        expected: {
          ...nextState,
          currentLayerIndex: 0,
        },
      },
    ];
    test.each(testCases)("$name", ({ state, actionPayload, expected }) => {
      const got = appReducer(state, {
        type: ActionType.SelectLayer,
        ...actionPayload,
      });
      expect(got).toEqual(expected);
    });

    test("invalid layerId", () => {
      expect(() => {
        appReducer(nextState, {
          type: ActionType.SelectLayer,
          layerId: "unknown layer id",
        });
      }).toThrow(Error);
    });
  });

  describe(ActionType.AddLayer.toString(), () => {
    const nextLayer: VectorLayerProps = {
      id: "layer-2",
      name: "Layer 2",
      type: LayerType.Vector,
      isSelected: false,
      lines: [],
    };

    const testCases: {
      name: string;
      state: AppState;
      actionPayload: Omit<AddLayerAction, "type">;
      expected: AppState;
    }[] = [
      {
        name: "add a vector layer",
        state: initialState,
        actionPayload: {
          layerType: LayerType.Vector,
        },
        expected: createState({
          state: initialState,
          layers: [...initialState.layers, nextLayer],
        }),
      },
      {
        name: "invalid layer type: image",
        state: initialState,
        actionPayload: {
          layerType: LayerType.Image,
        },
        expected: initialState,
      },
    ];
    test.each(testCases)("$name", ({ state, actionPayload, expected }) => {
      const got = appReducer(state, {
        type: ActionType.AddLayer,
        ...actionPayload,
      });
      expect(got).toEqual(expected);
    });
  });

  describe(ActionType.DeleteSelectedLayers.toString(), () => {
    const testCases: {
      name: string;
      state: AppState;
      expected: AppState;
    }[] = [
      {
        name: "delete a layer",
        ...(() => {
          const state = {
            ...initialState,
            layers: [
              { id: "layer 1", isSelected: false },
              { id: "layer 2", isSelected: true },
              { id: "layer 3", isSelected: false },
            ],
            currentLayerIndex: 2,
            history: [
              {
                layers: [
                  { id: "layer 1", isSelected: false },
                  { id: "layer 2", isSelected: true },
                  { id: "layer 3", isSelected: false },
                ],
              },
            ],
            historyIndex: 0,
          };
          const expected = createState({
            state,
            layers: [
              { id: "layer 1", isSelected: false },
              { id: "layer 3", isSelected: false },
            ],
            currentLayerIndex: 1,
          });

          return {
            state,
            expected,
          };
        })(),
      },
      {
        name: "delete multiple layers",
        ...(() => {
          const state = {
            ...initialState,
            layers: [
              { id: "layer 1", isSelected: false },
              { id: "layer 2", isSelected: true },
              { id: "layer 3", isSelected: true },
              { id: "layer 4", isSelected: false },
            ],
            currentLayerIndex: 2,
            history: [
              {
                layers: [
                  { id: "layer 1", isSelected: false },
                  { id: "layer 2", isSelected: true },
                  { id: "layer 3", isSelected: true },
                  { id: "layer 4", isSelected: false },
                ],
              },
            ],
            historyIndex: 0,
          };

          const expected = createState({
            state,
            layers: [
              { id: "layer 1", isSelected: false },
              { id: "layer 4", isSelected: false },
            ],
            currentLayerIndex: 0,
          });

          return {
            state,
            expected,
          };
        })(),
      },

      {
        name: "unselected layers must be at least one",
        state: {
          ...initialState,
          layers: initialState.layers.map((layer) => {
            return {
              ...layer,
              isSelected: true,
            };
          }),
        },
        expected: {
          ...initialState,
          statusCode: AppStatusCode.DeleteSelectedLayersNoLayer,
          layers: initialState.layers.map((layer) => {
            return {
              ...layer,
              isSelected: true,
            };
          }),
        },
      },
    ];
    test.each(testCases)("$name", ({ state, expected }) => {
      const got = appReducer(state, {
        type: ActionType.DeleteSelectedLayers,
      });
      expect(got).toEqual(expected);
    });
  });

  describe(ActionType.ImportImage.toString(), () => {
    const testImageLayer = {
      type: LayerType.Image,
      image: {
        id: "image 1",
        dataURL: "url",
        x: 1,
        y: 2,
      },
    };
    const testCases: {
      name: string;
      state: AppState;
      actionPayload: Omit<ImportImageAction, "type">;
      expected: AppState;
    }[] = [
      {
        name: "import an image layer, change the current layer to the image layer",
        state: initialState,
        actionPayload: {
          newLayer: testImageLayer,
        },
        expected: createState({
          state: initialState,
          layers: [...initialState.layers, testImageLayer],
          currentLayerIndex: 1,
        }),
      },
    ];
    test.each(testCases)("$name", ({ state, actionPayload, expected }) => {
      const got = appReducer(state, {
        type: ActionType.ImportImage,
        ...actionPayload,
      });
      expect(got).toEqual(expected);
    });
  });

  describe(ActionType.MoveImageLayer.toString(), () => {
    const testImageLayer = {
      type: LayerType.Image,
      image: {
        id: "image 1",
        dataURL: "url",
        x: 1,
        y: 2,
      },
    };

    const testState: AppState = {
      ...initialState,
      layers: [...initialState.layers, testImageLayer],
      history: [{ layers: [...initialState.layers, testImageLayer] }],
    };
    const testCases: {
      name: string;
      state: AppState;
      actionPayload: Omit<MoveImageLayerAction, "type">;
      expected: AppState;
    }[] = [
      {
        name: "move an image layer",
        state: testState,
        actionPayload: {
          layerId: testImageLayer.id,
          newPosition: {
            x: 100,
            y: 200,
          },
        },
        expected: createState({
          state: testState,
          layers: [
            ...initialState.layers,
            {
              ...testImageLayer,
              image: {
                ...testImageLayer.image,
                x: 100,
                y: 200,
              },
            },
          ],
        }),
      },
      {
        name: "invalid image layer id",
        state: testState,
        actionPayload: {
          layerId: "invalid layer id",
          newPosition: {
            x: 100,
            y: 200,
          },
        },
        expected: {
          ...testState,
          statusCode: AppStatusCode.MoveImageLayerInvalidLayerId,
        },
      },
      {
        name: "invalid layer type: vector",
        state: testState,
        actionPayload: {
          layerId: testState.layers[0].type,
          newPosition: {
            x: 100,
            y: 200,
          },
        },
        expected: {
          ...testState,
          statusCode: AppStatusCode.MoveImageLayerInvalidLayerId,
        },
      },
    ];
    test.each(testCases)("$name", ({ state, actionPayload, expected }) => {
      const got = appReducer(state, {
        type: ActionType.MoveImageLayer,
        ...actionPayload,
      });
      expect(got).toEqual(expected);
    });
  });

  describe(ActionType.DrawOnCanvas.toString(), () => {
    const color = "#eeeeee";
    const testLayer = initialState.layers[
      initialState.currentLayerIndex
    ] as VectorLayerProps;

    [Tool.Pen, Tool.Eraser].forEach((tool) => {
      describe(tool.toString(), () => {
        const testCases: {
          name: string;
          state: AppState;
          actionPayload: Omit<FreeDrawAction, "type" | "tool" | "color">;
          expected: AppState;
        }[] = [
          {
            name: "mouse down event",
            state: initialState,
            actionPayload: {
              mouseEventType: MouseEventType.Down,
              point: { x: 1, y: 2 },
            },
            expected: {
              ...initialState,
              layers: [
                { ...testLayer, lines: [{ tool, color, points: [1, 2] }] },
              ],
              isDrawing: true,
            },
          },
          {
            name: "mouse move event while drawing",
            state: {
              ...initialState,
              layers: [
                { ...testLayer, lines: [{ tool, color, points: [1, 2] }] },
              ],
              isDrawing: true,
            },
            actionPayload: {
              mouseEventType: MouseEventType.Move,
              point: {
                x: 10,
                y: 20,
              },
            },
            expected: {
              ...initialState,
              layers: [
                {
                  ...testLayer,
                  lines: [{ tool, color, points: [1, 2, 10, 20] }],
                },
              ],
              isDrawing: true,
            },
          },
          {
            name: "mouse up event while drawing",
            actionPayload: {
              mouseEventType: MouseEventType.Up,
              point: {
                x: 100,
                y: 200,
              },
            },
            ...(() => {
              const state = {
                ...initialState,
                layers: [
                  {
                    ...testLayer,
                    lines: [{ tool, color, points: [1, 2, 10, 20] }],
                  },
                ],
                isDrawing: true,
              };
              const expected = {
                ...createState({
                  state,
                  layers: [
                    {
                      ...testLayer,
                      lines: [{ tool, color, points: [1, 2, 10, 20] }],
                    },
                  ],
                }),
                isDrawing: false,
              };

              return {
                state,
                expected,
              };
            })(),
          },

          {
            name: "mouse move event while not drawing",
            actionPayload: {
              mouseEventType: MouseEventType.Move,
              point: {
                x: 100,
                y: 200,
              },
            },
            state: {
              ...initialState,
              isDrawing: false,
            },
            expected: {
              ...initialState,
              isDrawing: false,
            },
          },
          {
            name: "mouse up event while not drawing",
            actionPayload: {
              mouseEventType: MouseEventType.Up,
              point: {
                x: 100,
                y: 200,
              },
            },
            state: {
              ...initialState,
              isDrawing: false,
            },
            expected: {
              ...initialState,
              isDrawing: false,
            },
          },
        ];

        test.each(testCases)("$name", ({ state, actionPayload, expected }) => {
          const got = appReducer(state, {
            type: ActionType.DrawOnCanvas,
            tool,
            color,
            ...actionPayload,
          });
          expect(got).toEqual(expected);
        });
      });
    });

    describe(Tool.Move.toString(), () => {
      const testCases: {
        name: string;
        state: AppState;
        actionPayload: Omit<FreeDrawAction, "type">;
        expected: AppState;
      }[] = [
        {
          name: "TODO: not implemented yet",
          state: initialState,
          actionPayload: {},
          expected: initialState,
        },
      ];
      test.each(testCases)("$name", ({ state, actionPayload, expected }) => {
        const got = appReducer(state, {
          type: ActionType.DrawOnCanvas,
          tool: Tool.Move,
          ...actionPayload,
        });
        expect(got).toEqual(expected);
      });
    });
  });
});
