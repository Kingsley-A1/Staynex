// babel-preset-expo includes the Expo Router and Reanimated-safe transforms for
// SDK 50+. No extra plugins are required for the features used here.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
