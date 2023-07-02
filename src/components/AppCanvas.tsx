import { Color } from "./Color";

namespace AppCanvas {
  const numberOfArrayPerPixel = 4;

  export function getPointFromImageIndex(
    index: number,
    width: number
  ): { x: number; y: number } {
    const y = Math.floor(index / numberOfArrayPerPixel / width);
    const x = (index / numberOfArrayPerPixel) % width;
    return {
      y,
      x,
    };
  }

  export function getCanvasImageIndex(
    { x, y }: { x: number; y: number },
    width: number
  ) {
    return (width * y + x) * numberOfArrayPerPixel;
  }

  export function getNewArea(
    imageData: Uint8ClampedArray,
    color: Color,
    {
      startPoint,
      width,
      height,
    }: {
      startPoint: {
        x: number;
        y: number;
      };
      width: number;
      height: number;
    }
  ): number[] {
    const canvasImageIndex = getCanvasImageIndex(startPoint, width);
    const originalRed = imageData[canvasImageIndex];
    const originalGreen = imageData[canvasImageIndex + 1];
    const originalBlue = imageData[canvasImageIndex + 2];
    const originalAlpha = imageData[canvasImageIndex + 3];

    const {
      red: fillRed,
      green: fillGreen,
      blue: fillBlue,
    } = Color.toRGB(color);
    let imageMap: {
      [index: number]: {
        [index: number]: number;
      };
    } = {};

    const pixelStack: { y: number; x: number }[] = [startPoint];
    const result = [];

    while (pixelStack.length > 0) {
      const { x, y } = pixelStack.pop()!;
      if (y < 0) {
        continue;
      }
      if (x < 0) {
        continue;
      }
      if (x >= width) {
        continue;
      }
      if (y >= height) {
        continue;
      }

      const canvasImageIndex = getCanvasImageIndex({ x, y }, width);
      const red = imageData[canvasImageIndex];
      const green = imageData[canvasImageIndex + 1];
      const blue = imageData[canvasImageIndex + 2];
      // TODO: No way to store an alpha yet
      const alpha = imageData[canvasImageIndex + 3];

      if (imageMap[y] == null) {
        imageMap[y] = {};
      }
      if (imageMap[y][x] === 1) {
        // already searched
        continue;
      }
      imageMap[y][x] = 1;

      if (
        red === originalRed &&
        blue === originalBlue &&
        green === originalGreen &&
        alpha === originalAlpha
      ) {
        result[canvasImageIndex] = fillRed;
        result[canvasImageIndex + 1] = fillGreen;
        result[canvasImageIndex + 2] = fillBlue;
        result[canvasImageIndex + 3] = 255; // alpha

        pixelStack.push({ x: x - 1, y });
        pixelStack.push({ x: x + 1, y });
        pixelStack.push({ x, y: y - 1 });
        pixelStack.push({ x, y: y + 1 });
      }
    }
    return result;
  }

  export function fill(
    canvas: HTMLCanvasElement,
    startX: number,
    startY: number,
    color: Color
  ) {
    const canvasContext = canvas.getContext("2d");
    let canvasContextImageData = canvasContext!.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    const newImageData = getNewArea(canvasContextImageData.data, color, {
      startPoint: {
        x: startX,
        y: startY,
      },
      width: canvas.width,
      height: canvas.height,
    });
    newImageData.forEach((value, index) => {
      canvasContextImageData.data[index] = value;
    });

    return canvasContextImageData;
  }
}
export default AppCanvas;
