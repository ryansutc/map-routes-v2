export const prettyString = (string: string) => {
  // return a string converted from camelCase to seperated words
  // with the first letter in caps and caps letters new words.
  return string
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (str) => str.toUpperCase());
};
