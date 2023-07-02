# React Konva Simple Free Drawing

![CI test](https://github.com/michael-freling/react_konva_simple_drawing/actions/workflows/test.yml/badge.svg)

This is a simple drawing tool built by next.js and [react-konva](https://konvajs.org/docs/react/index.html).

This tool contains these features

- [Pen and Eraser](https://konvajs.org/docs/react/Free_Drawing.html)
- Fill
  - Refered to [this article](http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/)
- Layers
- [Color](https://codesandbox.io/s/jq5hm?file=/index.js:199-273)
- [Undo and Redo](https://konvajs.org/docs/react/Undo-Redo.html)
- [Export an image](https://konvajs.org/docs/react/Canvas_Export.html)
- [Import an image](https://konvajs.org/docs/react/Images.html)
  - Image is a [draggable](https://konvajs.org/docs/react/Drag_And_Drop.html)
- [Save](https://konvajs.org/docs/data_and_serialization/Best_Practices.html)
  - Save a file as JSON

## Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.
