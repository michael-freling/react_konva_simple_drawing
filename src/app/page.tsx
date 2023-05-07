"use client";

import { Stage, Layer, Rect } from "react-konva";

function MyComponent() {
  return (
    <Stage width={400} height={400}>
      <Layer>
        <Rect x={50} y={50} width={100} height={100} fill="red" />
      </Layer>
    </Stage>
  );
}

export default function Home() {
  return <MyComponent />;
}
