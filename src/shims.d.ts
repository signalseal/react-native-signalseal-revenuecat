// `setTimeout` is provided by React Native's runtime; we only need the
// one-shot delayed-callback signature here. (Avoids pulling in the DOM
// or @types/node libs just for this.)
declare function setTimeout(handler: () => void, timeoutMs?: number): unknown;
