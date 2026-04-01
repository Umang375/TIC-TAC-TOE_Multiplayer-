import resolve from '@rollup/plugin-node-resolve';
import commonJS from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/main.ts',
  external: ['nakama-runtime'],
  plugins: [
    resolve({ extensions: ['.ts', '.js'] }),
    typescript(),
    json(),
    commonJS({ extensions: ['.ts', '.js'] }),
  ],
  output: {
    file: 'build/index.js',
    format: 'es',
  },
};
