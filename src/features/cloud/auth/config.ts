const env = import.meta.env
export const cloudConfigured = Boolean(env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_AUTH_DOMAIN && env.VITE_FIREBASE_APP_ID && env.VITE_FIREBASE_STORAGE_BUCKET)
