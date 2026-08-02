const values = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4050/api/v1',
  websocketUrl: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4050',
  websocketPath: process.env.NEXT_PUBLIC_WS_PATH || '/socket.io',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Sri Lanka Railway Booking',
  defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'LKR',
};
for (const [key, value] of Object.entries(values)) if (!value) throw new Error(`Missing public environment variable: ${key}`);
export const env = Object.freeze(values);
