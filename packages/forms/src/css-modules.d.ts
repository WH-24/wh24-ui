/**
 * Ambient declaration for CSS Modules (*.module.css imports).
 *
 * TypeScript doesn't know about CSS Modules natively. This declaration
 * tells it that any `*.module.css` import returns an object mapping
 * local class names to generated unique strings.
 *
 * Consumer bundlers (Vite / webpack with css-loader) handle the
 * actual transformation at build time.
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
