import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { existsSync } from 'fs';
import dts from 'vite-plugin-dts';

// Определяем режим работы
const isAppMode = existsSync(resolve(__dirname, 'index.html'));

// Базовые настройки, общие для всех режимов
const baseConfig: UserConfig = {
  plugins: [
    react(),
    // Добавляем генерацию типов только в режиме библиотеки
    ...(isAppMode ? [] : [
      dts({
        insertTypesEntry: true,
        outDir: 'dist',
        exclude: ['**/*.test.ts', '**/*.spec.ts']
      })
    ])
  ],
  optimizeDeps: {
    include: ['void-elements']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
};

export default defineConfig(({ command}) => {
  if (command === 'build' && !isAppMode) {
    // Режим сборки библиотеки
    return {
      ...baseConfig,
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          formats: ['es'],
          fileName: 'index'
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'jsxRuntime'
            },
            // Сохраняем структуру директорий
            preserveModules: false
          }
        },
        sourcemap: true,
        outDir: 'dist',
        // Минимизируем, но оставляем читаемым
        minify: 'esbuild',
        // Собираем CSS внутрь JS
        cssCodeSplit: false
      }
    };
  }

  // Режим приложения (разработка или сборка)
  return {
    ...baseConfig,
    build: {
      outDir: 'dist-app',
      sourcemap: true,
      rollupOptions: {
        input: isAppMode ? resolve(__dirname, 'index.html') : undefined,
      }
    },
    server: {
      port: 5173,
      open: true
    },
    preview: {
      port: 3001
    }
  };
});