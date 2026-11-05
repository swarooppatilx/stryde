import type { ComponentType } from 'react';

function createCompoundComponent<
  T extends ComponentType<never>,
  TCompound extends Record<string, unknown> = Record<string, never>,
>(name: string, component: T, compound: TCompound = {} as TCompound): T & TCompound {
  component.displayName = name;

  return Object.assign(component, compound);
}

export { createCompoundComponent };
