import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api'),
  withCredentials: true
});

export function downloadUrl(path) {
  return `${api.defaults.baseURL}${path}`;
}
