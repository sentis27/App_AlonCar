import { defineConfig } from 'vitest/config'

// Configuración de tests separada de vite.config.js para no afectar el build de producción.
// Los tests viven en app/tests/ (fuera de app/src/) para no interferir con los límites
// de líneas que vigila scripts/repo-hygiene.mjs sobre app/src/.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
  },
})
