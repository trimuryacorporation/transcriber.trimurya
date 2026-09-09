import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(path);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => { load(); }, deps);
  return { data, loading, error, reload: load };
}
