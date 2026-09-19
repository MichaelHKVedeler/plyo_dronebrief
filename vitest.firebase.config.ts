import { defineConfig } from 'vitest/config'
export default defineConfig({ test: {
  environment: 'node', include: ['firebase-tests/**/*.test.ts'], fileParallelism: false, testTimeout: 60000, hookTimeout: 60000,
  env: { GCLOUD_PROJECT: 'demo-dronebrief', FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-dronebrief', storageBucket: 'demo-dronebrief.appspot.com' }) },
} })
