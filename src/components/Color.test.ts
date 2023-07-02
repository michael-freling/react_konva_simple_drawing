import { Color } from "./Color";

describe("Color", () => {
  test.each([
    {
      name: "red",
      str: "#ff0000",
      expected: {
        red: 255,
        green: 0,
        blue: 0,
      },
    },
    {
      name: "green",
      str: "#00ff00",
      expected: {
        red: 0,
        green: 255,
        blue: 0,
      },
    },
    {
      name: "blue",
      str: "#0000ff",
      expected: {
        red: 0,
        green: 0,
        blue: 255,
      },
    },
  ])("$name", ({ str, expected }) => {
    const actual = Color.toRGB(str);
    expect(actual).toEqual(expected);
    expect(Color.fromRGB(actual)).toEqual(str);
  });
});
