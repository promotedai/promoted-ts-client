import copy from 'rollup-plugin-copy';
// import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import del from 'rollup-plugin-delete';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import pkg from './package.json';

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

export default [
  {
    input: 'src/index.ts',
    external: ['react'],
    plugins: [
      del({ targets: 'dist/*' }),
      typescript({
        typescript: require('typescript'),
      }),
      copy({
        targets: [
          { src: 'README.md', dest: 'dist' },
          { src: 'CHANGELOG.md', dest: 'dist' },
        ],
      }),
      generatePackageJson({
        baseContents: (pkg) => ({
          ...pkg,
          name: pkg.name,
          main: `${pkg.name}.umd.js`,
          module: `${pkg.name}.esm.js`,
          typings: `index.d.ts`,
          scripts: undefined,
          devDependencies: {},
          config: undefined,
        }),
      }),
      // Commenting out to make it easier to debug.
      // terser(),
    ],
    output: [
      {
        name: pkg.name,
        file: `dist/${pkg.name}.umd.js`,
        format: 'umd',
        globals: {
          react: 'react',
        },
        sourcemap: true,
      },
      { file: `dist/${pkg.name}.esm.js`, format: 'es', sourcemap: true },
    ],
  },
];
