export const environment = {
  production: true,
  get serverUrl(): string {
    return `http://${window.location.hostname}:3000`;
  },
  serverPort: 3000,
  angularPort: 4200,
};
