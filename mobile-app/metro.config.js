// metro.config.js
// MANDATORY for Expo SDK 53+: Firebase JS SDK uses .cjs files that Metro's
// unstable_enablePackageExports resolver cannot resolve. Disabling it prevents
// "Component auth has not been registered yet" crashes at runtime.
// Source: https://github.com/expo/expo/issues/36588
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
