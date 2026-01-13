import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command, mode }) => {
  // Явно определяем режим библиотеки по флагу
  const isLibMode = mode === 'lib' || command === 'build' && !process.env.IS_APP;
  
  if (isLibMode) {
    // Режим библиотеки
    return {
      plugins: [
        react(),
        dts({
          insertTypesEntry: true,
          outDir: 'dist',
          include: ['src'],
          exclude: ['**/*.test.ts', '**/*.spec.ts']
        })
      ],
      optimizeDeps: {
        include: ['void-elements']
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      },
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'drawboard-microservice',
          fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
          formats: ['es', 'cjs']
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react/jsx-runtime': 'jsxRuntime'
            },
            exports: 'named',
            interop: 'auto',
            assetFileNames: (assetInfo) => {
              if (assetInfo.name?.endsWith('.css')) {
                return 'style.css';
              }
              return assetInfo.name || 'assets/[name]-[hash][extname]';
            }
          }
        },
        sourcemap: true,
        outDir: 'dist',
        minify: false,
        emptyOutDir: true,
        cssCodeSplit: false, // Критически важно для библиотек
        cssMinify: false
      }
    };
  }

  // Режим разработки (локальный запуск) или сборка приложения
  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['void-elements']
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      outDir: 'dist-app',
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    },
    server: {
      port: 5173,
      open: true
    }
  };
});