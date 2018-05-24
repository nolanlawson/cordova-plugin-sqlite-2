import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'src/javascript/index.js',
  output: {
    file: 'dist/sqlite-plugin.js',
    format: 'umd'
  },
  name: 'sqlitePlugin',
  plugins: [
    resolve(),
    commonjs()
  ]
};
