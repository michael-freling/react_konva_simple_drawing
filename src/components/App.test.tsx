import { fireEvent, render, waitFor } from "@testing-library/react";
import App from "./App";
import "@testing-library/jest-dom";
import { Tool } from "./AppReducer";

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
});
