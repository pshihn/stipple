import resolve from 'rollup-plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: 'lib/stipple.js',
    output: {
      file: 'bundled/stipple.iife.js',
      format: 'iife',
      name: 'stipple'
    },
    plugins: [resolve(), terser()]
  }
];