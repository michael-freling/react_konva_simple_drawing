import { newImportImageCommand } from "./file";
import { newLayer } from "./layer";
import { LayerType, Tool } from "./type";

// const imageFile = fs.readFileSync(  path.resolve(__dirname, "./tests/fixtures/image.jpg"));

// https://github.com/jsdom/jsdom/issues/1272#issuecomment-264856374
const createFile = (size = 44320, name = "ecp-logo.png", type = "image/png") =>
  new File([new ArrayBuffer(size)], name, {
    type: type,
  });

// https://github.com/jsdom/jsdom/issues/1272#issuecomment-476089616
const mockFileList = (files: Array<File>): FileList => {
  return {
    length: files.length,
    item: (index: number) => files[index],
    *[Symbol.iterator]() {
      for (let i = 0; i < files.length; i++) {
        yield files[i];
      }
    },
    ...files,
  };
};

describe("newImportImageCommand", () => {
  const defaultCurrentLayerId = "initial-layer";

  const defaultMockFile = createFile(1024, "image.jpeg", "image/jpeg");
  const expectedImageLayer = newLayer({
    name: defaultMockFile.name,
    type: LayerType.Image,
    layers: [],
  });
  const runCases = [
    {
      name: "",
      files: mockFileList([defaultMockFile]),
      layers: [],
      currentLayerId: defaultCurrentLayerId,
      expectedLayers: [expectedImageLayer],
      expectedCurrentLayerId: expectedImageLayer.id,
    },
  ];
  test.each(runCases)(
    "$name",
    async ({
      files,
      layers,
      currentLayerId,
      expectedLayers,
      expectedCurrentLayerId,
    }) => {
      const command = newImportImageCommand(files);
      expect(command.files).toHaveLength(files.length);

      await command.run({
        layers,
        setLayers: (actual) => {
          expect(actual).toEqual(expectedLayers);
        },
        currentLayerId,
        setCurrentLayerId: (actual) => {
          expect(actual).toBe(expectedCurrentLayerId);
        },
        setTool: (actual) => {
          expect(actual).toBe(Tool.Move);
        },
      });

      command.undo({
        layers: expectedLayers,
        setLayers: (actual) => {
          expect(actual).toEqual(layers);
        },
        setCurrentLayerId: (actual) => {
          expect(actual).toEqual(expectedCurrentLayerId);
        },
      });
    }
  );
});
