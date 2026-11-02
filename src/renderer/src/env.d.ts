/// <reference types="vite/client" />

import type * as React from 'react'

declare global {
  // React 19 / @types/react@19 moved the JSX namespace under React.JSX and
  // removed the global one. Re-alias it globally so existing `JSX.Element`
  // annotations across the renderer keep resolving.
  namespace JSX {
    type Element = React.JSX.Element
    type ElementClass = React.JSX.ElementClass
    type ElementAttributesProperty = React.JSX.ElementAttributesProperty
    type ElementChildrenAttribute = React.JSX.ElementChildrenAttribute
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>
    type IntrinsicAttributes = React.JSX.IntrinsicAttributes
    type IntrinsicClassAttributes<T> = React.JSX.IntrinsicClassAttributes<T>
    type IntrinsicElements = React.JSX.IntrinsicElements
  }

  interface Window {
    api: import('../../preload/index').API
    // Set by App to open the onboarding wizard in preview mode (Settings > General).
    __CYBERFEEDS_SHOW_ONBOARDING_PREVIEW__?: () => void
  }
}

export {}
