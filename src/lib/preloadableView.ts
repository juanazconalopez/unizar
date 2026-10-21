import { createElement, lazy, useState } from 'react'
import type { ComponentType } from 'react'

export function preloadableView<Props extends object>(loader: () => Promise<{ default: ComponentType<Props> }>) {
  let resolved: ComponentType<Props> | undefined
  let pending: ReturnType<typeof loader> | undefined
  function preload() {
    pending ??= loader().then((module) => { resolved = module.default; return module })
    return pending
  }
  const Deferred = lazy(preload)
  function View(props: Props) {
    // A prepared module renders synchronously on its first visit. Keep the
    // chosen component stable for this mount, preserving forms and local state
    // if an initially deferred load finishes during a parent update.
    const [Component] = useState(() => resolved ?? Deferred)
    return createElement(Component, props)
  }
  return { View, preload }
}
