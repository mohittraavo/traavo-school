module.exports = function (api) {
  api.cache(true);
  return {
    // Disable the preset's auto Worklets/Reanimated plugins so we only run
    // react-native-reanimated/plugin once (it re-exports worklets 0.10.1).
    presets: [['babel-preset-expo', { worklets: false, reanimated: false }]],
    plugins: ['react-native-reanimated/plugin'],
  };
};
