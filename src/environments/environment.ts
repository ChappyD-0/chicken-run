/**
 * Development environment.
 * serverUrl is built at runtime from window.location.hostname so the same
 * build works on the host machine AND from any phone on the local network.
 */
export const environment = {
  production: false,
  /** Resolved at runtime: same host, port 3000 */
  get serverUrl(): string {
    return `http://${window.location.hostname}:3000`;
  },
  serverPort: 3000,
  angularPort: 4200,
};

