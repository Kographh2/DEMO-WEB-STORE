declare module 'minimatch' {
  function minimatch(s: string, pattern: string, options?: any): boolean
  export = minimatch
}
