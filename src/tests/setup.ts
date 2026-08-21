import "@testing-library/jest-dom/vitest";

// jsdom lacks the Pointer Capture API that sonner's swipe handler uses.
if (!("setPointerCapture" in Element.prototype)) {
  Object.assign(Element.prototype, {
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() {
      return false;
    },
  });
}
