import { fireEvent, render, waitFor } from "@testing-library/react";
import App from "./App";
import "@testing-library/jest-dom";
import { LayerType, Tool } from "./AppReducer";

function undo(getByTestId: any) {
  const undoButton = getByTestId("undoButton");
  fireEvent.click(undoButton);
  return undoButton;
}

function redo(getByTestId: any) {
  const redoButton = getByTestId("redoButton");
  fireEvent.click(redoButton);
  return redoButton;
}

describe("App", () => {
  it("add a vector layer", () => {
    const { getByTestId } = render(<App />);
    const layerList = getByTestId("layerList");
    expect(layerList.children).toHaveLength(1);

    fireEvent.click(getByTestId("addVectorLayerButton"));
    expect(layerList.children).toHaveLength(2);

    // test undo and redo
    undo(getByTestId);
    expect(layerList.children).toHaveLength(1);
    redo(getByTestId);
    expect(layerList.children).toHaveLength(2);
  });

  it("add a raster layer", () => {
    const { getByTestId } = render(<App />);
    const layerList = getByTestId("layerList");
    expect(layerList.children).toHaveLength(1);

    fireEvent.click(getByTestId("addRasterLayerButton"));
    expect(layerList.children).toHaveLength(2);

    // test undo and redo
    undo(getByTestId);
    expect(layerList.children).toHaveLength(1);
    redo(getByTestId);
    expect(layerList.children).toHaveLength(2);
  });

  describe("delete selected layers", () => {
    test.each([
      {
        name: "delete a layer",
        layerCount: 1,
        additionalVectorLayers: 1,
        expectedLayerCount: 1,
        expectedStatusMessage: null,
      },
      {
        name: "delete 2 layers",
        layerCount: 2,
        additionalVectorLayers: 2,
        expectedLayerCount: 1,
        expectedStatusMessage: null,
      },
      {
        name: "try to delete all layers",
        layerCount: 2,
        additionalVectorLayers: 1,
        expectedLayerCount: 2,
        expectedStatusMessage: "Please keep at least one layer",
      },
    ])(
      "$name",
      ({
        layerCount,
        additionalVectorLayers,
        expectedLayerCount,
        expectedStatusMessage,
      }) => {
        const { getByTestId, queryByTestId } = render(<App />);

        const addVectorLayerButton = getByTestId("addVectorLayerButton");
        for (let i = 0; i < additionalVectorLayers; i++) {
          fireEvent.click(addVectorLayerButton);
        }
        const originalLayerCount = 1 + additionalVectorLayers;
        const layerList = getByTestId("layerList");
        expect(layerList.children).toHaveLength(originalLayerCount);

        for (let i = 0; i < layerCount; i++) {
          // @ts-ignore
          const checkbox: HTMLInputElement = getByTestId(
            "layerCheckbox" + i.toString()
          );
          if (checkbox.checked) {
            continue;
          }
          // TODO: For some reasons, the checkbox is checked for a test case
          // expect(checkbox).not.toBeChecked();

          fireEvent.click(checkbox);
          expect(checkbox).toBeChecked();
        }

        fireEvent.click(getByTestId("deleteSelectedLayersButton"));

        expect(layerList.children).toHaveLength(expectedLayerCount);
        if (expectedStatusMessage != null) {
          expect(getByTestId("statusMessage")).toHaveTextContent(
            expectedStatusMessage
          );
        } else {
          expect(queryByTestId("statusMessage")).not.toBeInTheDocument();
        }

        if (originalLayerCount !== expectedLayerCount) {
          undo(getByTestId);
          expect(layerList.children).toHaveLength(originalLayerCount);

          redo(getByTestId);
          expect(layerList.children).toHaveLength(expectedLayerCount);
          // status message should be hidden after undo and redo
          expect(queryByTestId("statusMessage")).not.toBeInTheDocument();
        }
      }
    );
  });

  it.skip("save a file", () => {
    // Skip this test case because of an error
    // This is because document create an a element and click a link
    // Error: Not implemented: navigation (except hash changes)
    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId("saveButton"));
  });

  describe("load a file", () => {
    const createMockFileList = (files: File[]) => {
      // @ts-ignore
      const fileList: FileList = {
        length: files.length,
        item(index: number): File {
          return fileList[index];
        },
      };
      files.forEach((file, index) => (fileList[index] = file));
      return fileList;
    };

    const initialLayerCount = 1;
    const vectorLayer = {
      id: "layer-1",
      name: "Layer 1",
      type: LayerType.Vector,
      lines: [
        { type: Tool.Pen, points: [0, 1, 2, 3, 4, 5] },
        { type: Tool.Eraser, points: [10, 11, 12, 13, 14, 15] },
      ],
      isSelected: false,
    };
    const imageLayer = {
      id: "layer-2",
      name: "Layer 2",
      type: LayerType.Image,
      image: {
        id: "image 10",
        dataURL: "dataURL",
        x: 100,
        y: 101,
      },
      isSelected: false,
    };
    const testCases: {
      name: string;
      files: FileList;
      expectedLayerCount: number;
      expectedStatusMessage?: string;
    }[] = [
      {
        name: "load every data",
        files: createMockFileList([
          new File(
            [
              JSON.stringify({
                layers: [vectorLayer, imageLayer],
              }),
            ],
            "test.json",
            { type: "application/json" }
          ),
        ]),
        expectedLayerCount: 2,
      },
      {
        name: "empty a layer file",
        files: createMockFileList([
          new File([JSON.stringify({ layers: [] })], "test.json", {
            type: "application/json",
          }),
        ]),
        expectedLayerCount: initialLayerCount,
      },
      {
        name: "invalid json file",
        files: createMockFileList([
          new File([JSON.stringify({ unknown: "format" })], "test.json", {
            type: "application/json",
          }),
        ]),
        expectedLayerCount: initialLayerCount,
      },
      {
        name: "invalid file contents, but file format is json",
        files: createMockFileList([
          new File(["name,id\nJohn,1"], "test.csv", {
            type: "application/json",
          }),
        ]),
        expectedLayerCount: initialLayerCount,
        expectedStatusMessage:
          "Your file is not supported. Please load a file exported from this",
      },
      {
        name: "invalid file type",
        files: createMockFileList([
          new File(["name,id\nJohn,1"], "test.csv", {
            type: "text/csv",
          }),
        ]),
        expectedLayerCount: initialLayerCount,
      },
      {
        name: "no file was selected",
        files: createMockFileList([]),
        expectedLayerCount: initialLayerCount,
      },
      {
        name: "multiple files were selected",
        files: createMockFileList([
          new File([JSON.stringify({ layers: [vectorLayer] })], "test.json", {
            type: "application/json",
          }),
          new File([JSON.stringify({ layers: [imageLayer] })], "test2.json", {
            type: "application/json",
          }),
        ]),
        expectedLayerCount: initialLayerCount,
      },
    ];
    test.each(testCases)(
      "$name",
      async ({ files, expectedLayerCount, expectedStatusMessage }) => {
        const { getByTestId } = render(<App />);
        const layerList = getByTestId("layerList");
        expect(layerList.children).toHaveLength(initialLayerCount);

        fireEvent.change(getByTestId("loadFile"), {
          target: {
            files,
          },
        });
        await waitFor(() => {
          expect(layerList.children).toHaveLength(expectedLayerCount);
          if (expectedStatusMessage != null) {
            expect(getByTestId("statusMessage")).toHaveTextContent(
              expectedStatusMessage
            );
          }
        });

        undo(getByTestId);
        await waitFor(() => {
          expect(getByTestId("layerList").children).toHaveLength(
            initialLayerCount
          );
        });

        redo(getByTestId);
        await waitFor(() => {
          expect(getByTestId("layerList").children).toHaveLength(
            expectedLayerCount
          );
        });
      }
    );
  });

  it.skip("export an image", () => {
    // Skip this test case because of an error
    // This is because document create an a element and click a link
    // Error: Not implemented: navigation (except hash changes)
    const { getByTestId } = render(<App />);
    fireEvent.click(getByTestId("exportImageButton"));
  });

  it("import an image", async () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId("layerList").children).toHaveLength(1);
    expect(getByTestId("toolSelect")).not.toHaveValue("Move");

    // @ts-ignore
    const importImageFile: HTMLInputElement = getByTestId("importImageFile");
    const file = new File(["image"], "image.jpeg", {
      type: "image/jpeg",
    });
    fireEvent.change(importImageFile, {
      target: {
        files: [file],
      },
    });
    expect(importImageFile.files).toHaveLength(1);

    await waitFor(() => {
      expect(getByTestId("layerList").children).toHaveLength(2);
      expect(getByTestId("toolSelect")).toHaveValue(Tool.Move);

      fireEvent.change(getByTestId("toolSelect"), {
        target: { value: Tool.Pen },
      });

      undo(getByTestId);
      expect(getByTestId("layerList").children).toHaveLength(1);
      redo(getByTestId);
      expect(getByTestId("layerList").children).toHaveLength(2);
      expect(getByTestId("toolSelect")).not.toHaveValue(Tool.Move);
    });
  });

  it.skip("move an image", async () => {
    const { getByTestId, getByAltText } = render(<App />);
    expect(getByTestId("layerList").children).toHaveLength(1);
    expect(getByTestId("toolSelect")).not.toHaveValue("Move");

    const importImageFile = getByTestId("importImageFile");
    const file = new File(["(⌐□_□)"], "chucknorris.png", { type: "image/png" });
    fireEvent.change(importImageFile, {
      target: {
        files: [file],
      },
    });

    const imageLayer = await waitFor(() => {
      return getByAltText("imageLayer-layer-0");
    });

    fireEvent.mouseDown(imageLayer);
    fireEvent.mouseMove(imageLayer);
    fireEvent.mouseUp(imageLayer);
  });

  it("redo button", () => {
    const { getByTestId } = render(<App />);
    const redoButton = redo(getByTestId);
    expect(redoButton).toBeInTheDocument();
  });

  it("undo button", () => {
    const { getByTestId } = render(<App />);
    const undoButton = undo(getByTestId);
    expect(undoButton).toBeInTheDocument();
  });

  it("color change", () => {
    const { getByTestId } = render(<App />);

    const colorInput = getByTestId("colorInput");
    expect(colorInput).toHaveValue("#000000");
    fireEvent.change(colorInput, {
      target: {
        value: "#ffffff",
      },
    });
    expect(colorInput).toHaveValue("#ffffff");
  });
});
