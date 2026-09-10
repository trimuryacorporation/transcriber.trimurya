import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL;
const isBrowserLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isConfiguredLocalhost = configuredApiUrl && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?/i.test(configuredApiUrl);
const baseURL = isConfiguredLocalhost && !isBrowserLocalhost
  ? '/api'
  : configuredApiUrl || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

export const api = axios.create({
  baseURL,
  withCredentials: true
});

export function downloadUrl(path) {
  return `${api.defaults.baseURL}${path}`;
}
