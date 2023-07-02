import AppCanvas from "./AppCanvas";
import { Color } from "./Color";
const { getPointFromImageIndex, getCanvasImageIndex, getNewArea } = AppCanvas;

function createCanvasImageArrayFromPixels(pixels: Color[][], width: number) {
  const result: number[] = [];
  pixels.forEach((pixelRow, y) => {
    pixelRow.forEach((pixel, x) => {
      const { red, blue, green } = Color.toRGB(pixel);
      const index = getCanvasImageIndex({ x, y }, width);
      result[index] = red;
      result[index + 1] = green;
      result[index + 2] = blue;
      result[index + 3] = 1;
    });
  });

  return new Uint8ClampedArray(result);
}

function createPixelsFromImageArray(
  array: Uint8ClampedArray,
  width: number
): Color[][] {
  const result: Color[][] = [];
  for (let index = 0; index < array.length; index += 4) {
    const { x, y } = getPointFromImageIndex(index, width);
    const red = array[index];
    const green = array[index + 1];
    const blue = array[index + 2];
    const alpha = array[index + 3];
    if (result[y] == null) {
      result[y] = [];
    }

    result[y][x] = Color.fromRGB({ red, green, blue });
  }
  return result;
}

describe(getPointFromImageIndex.toString(), () => {
  test.each([
    {
      name: "one pixel",
      index: 0,
      width: 1,
      expected: {
        y: 0,
        x: 0,
      },
    },
    {
      name: "1d array",
      index: 4,
      width: 2,
      expected: {
        y: 0,
        x: 1,
      },
    },
    {
      name: "2d array",
      index: 12,
      width: 2,
      expected: {
        y: 1,
        x: 1,
      },
    },
  ])("$name", ({ expected, index, width }) => {
    expect(getPointFromImageIndex(index, width)).toEqual(expected);
  });
});

describe("imageArray for test functions", () => {
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";
  const white = "#ffffff";
  test.each([
    {
      name: "red, green, blue, white",
      pixels: [
        [red, green],
        [blue, white],
      ],
      width: 2,
      expected: [255, 0, 0, 1, 0, 255, 0, 1, 0, 0, 255, 1, 255, 255, 255, 1],
    },
    {
      name: "red",
      pixels: [[red]],
      width: 1,
      expected: [255, 0, 0, 1],
    },
  ])("$name", ({ pixels, width, expected }) => {
    const actual = createCanvasImageArrayFromPixels(pixels, width);
    expect(actual).toEqual(new Uint8ClampedArray(expected));
    const actualPixels = createPixelsFromImageArray(actual, width);
    expect(actualPixels).toEqual(pixels);
  });
});

describe(getNewArea.toString(), () => {
  const red = "#ff0000";
  // const green = "#00ff00";
  const blue = "#0000ff";
  const white = "#ffffff";
  const initValue = "#000000";

  test.each([
    {
      name: "2 dimensions",
      pixels: [
        [red, white, white],
        [white, white, red],
        [white, white, white],
        [red, white, white],
        [white, white, red],
      ],
      fillColor: blue,
      startPoint: { x: 1, y: 2 },
      width: 3,
      height: 5,
      expected: [
        [initValue, blue, blue],
        [blue, blue, initValue],
        [blue, blue, blue],
        [initValue, blue, blue],
        [blue, blue],
      ],
    },
    {
      name: "1 array",
      pixels: [[white, red, white]],
      fillColor: blue,
      startPoint: { x: 2, y: 0 },
      width: 3,
      height: 1,
      expected: [[initValue, initValue, blue]],
    },
    {
      name: "1 pixel",
      pixels: [[white]],
      fillColor: blue,
      startPoint: { x: 0, y: 0 },
      width: 1,
      height: 1,
      expected: [[blue]],
    },
  ])("$name", ({ pixels, startPoint, width, height, fillColor, expected }) => {
    const actual = getNewArea(
      createCanvasImageArrayFromPixels(pixels, width),
      fillColor,
      {
        startPoint,
        width,
        height,
      }
    );
    expect(
      createPixelsFromImageArray(new Uint8ClampedArray(actual), width)
    ).toEqual(expected);
  });
});
