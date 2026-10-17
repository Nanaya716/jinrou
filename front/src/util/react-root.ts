import * as React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

export interface MountedRoot {
  render(element: React.ReactElement): void;
  unmount(): void;
}

function wrapRoot(root: Root): MountedRoot {
  return {
    render(element) {
      root.render(element);
    },
    unmount() {
      root.unmount();
    },
  };
}

export function createMountedRoot(node: Element): MountedRoot {
  return wrapRoot(createRoot(node));
}

export function mountReact(
  node: Element,
  element: React.ReactElement,
): MountedRoot {
  const root = createMountedRoot(node);
  flushSync(() => {
    root.render(element);
  });
  return root;
}
