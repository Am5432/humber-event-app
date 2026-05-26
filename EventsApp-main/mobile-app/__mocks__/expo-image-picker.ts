export const launchImageLibraryAsync = jest.fn(async () => ({
  canceled: true,
  assets: [],
}));

export default {
  launchImageLibraryAsync,
};
