module.exports = (api) => ({
  presets: [['@babel/preset-env', {
    targets: {
      node: 'current',
      esmodules: !api.env('NODE_TEST'),
    },
  }]],
});
