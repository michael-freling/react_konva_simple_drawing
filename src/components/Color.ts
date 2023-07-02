export type Color = string;

export namespace Color {
  const toHexString = (bytes: number[]) => {
    return Array.from(bytes, (byte) => {
      return ("0" + (byte & 0xff).toString(16)).slice(-2);
    }).join("");
  };

  export function fromRGB({
    red,
    green,
    blue,
  }: {
    red: number;
    green: number;
    blue: number;
  }) {
    return "#" + toHexString([red, green, blue]);
  }
  export function toRGB(color: Color): {
    red: number;
    green: number;
    blue: number;
  } {
    const red = parseInt(color.substring(1, 3), 16);
    const green = parseInt(color.substring(3, 5), 16);
    const blue = parseInt(color.substring(5, 7), 16);
    return {
      red,
      green,
      blue,
    };
  }
}
