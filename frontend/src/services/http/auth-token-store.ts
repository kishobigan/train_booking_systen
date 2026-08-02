type Listener = (token: string | null) => void;
let accessToken: string | null = null; const listeners = new Set<Listener>();
export const authTokenStore = { getAccessToken: () => accessToken, setAccessToken(token: string | null) { accessToken = token; listeners.forEach((listener) => listener(token)); }, clear() { this.setAccessToken(null); }, subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener); } };
