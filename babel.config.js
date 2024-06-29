export default {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: false, loose: true }],
    '@babel/preset-typescript',
  ],
};
