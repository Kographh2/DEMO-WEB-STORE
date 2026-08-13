declare module 'prop-types' {
  export function checkPropTypes(
    typeSpecs: any,
    values: any,
    location: string,
    componentName: string,
    getStack: any
  ): void
}
