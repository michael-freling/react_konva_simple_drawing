import { newLayer } from "./layer";
import {
  AppState,
  ImageLayer,
  LayerType,
  Operation,
  OperationType,
  Tool,
} from "./type";

export function newImportImageCommand(files: FileList) {
  return new ImportImageCommand(files);
}

class PromiseFileReader {
  fileReader: FileReader = new FileReader();

  readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      this.fileReader.onload = (e: ProgressEvent<FileReader>) => {
        resolve(e.target!.result as string);
      };
      this.fileReader.readAsDataURL(file);
    });
  }
}

class ImportImageCommand implements OperationType {
  operation = Operation.Import;
  files: File[] = [];
  imported: string[] = [];
  fileReaderPromises: Promise<string>[];

  constructor(files: FileList) {
    let promises: Promise<string>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith("image/")) {
        continue;
      }

      this.files.push(file);
      const promiseFileReader = new PromiseFileReader();
      promises.push(promiseFileReader.readAsDataURL(file));
    }
    this.fileReaderPromises = promises;
  }

  run({
    layers,
    setLayers,
    setCurrentLayerId,
    setTool,
  }: AppState): Promise<string[]> {
    return Promise.all(this.fileReaderPromises).then((result) => {
      // this.imported = result;

      let newLayers = result.map((item, index) => {
        const file = this.files[index];
        const layer = newLayer({
          name: file.name,
          type: LayerType.Image,
          layers,
        });
        (layer as ImageLayer).image = {
          id: file.name,
          src: item,
          x: 0,
          y: 0,
        };
        console.log(layer);

        return layer;
      });

      setLayers([...layers, ...newLayers]);
      setTool(Tool.Move);
      setCurrentLayerId(newLayers[0].id);
      return result;
      /*
      {
          operation: Operation.Import,
          image: {
            id: file.name,
            src: this.imported[index],
            x: 0,
            y: 0,
          },
          layers: [layer.id],
        };
        */
    });
  }

  undo({ layers, setLayers }: AppState) {}
}
