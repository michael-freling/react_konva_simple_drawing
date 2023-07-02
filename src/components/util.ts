export function assert(condition: boolean, message: string, context: Object) {
  if (!condition) {
    throw new Error(message, context);
  }
}

// https://stackoverflow.com/questions/48230773/how-to-create-a-partial-like-that-requires-a-single-property-to-be-set
export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;
