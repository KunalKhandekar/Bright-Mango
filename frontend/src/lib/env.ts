export const env = {
  apiUrl: import.meta.env.VITE_API_URL as string,
  streamCustomerDomain: (import.meta.env.VITE_STREAM_CUSTOMER_DOMAIN ?? '') as string,
  isDev: import.meta.env.DEV,
}
