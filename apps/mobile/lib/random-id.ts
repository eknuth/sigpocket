/** Generate a random hex ID safe for React Native / Expo Go (no Web Crypto needed). */
export function randomId(): string {
  const s = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
}
