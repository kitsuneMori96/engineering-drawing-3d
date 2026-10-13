import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 相对路径:支持 GitHub Pages 项目子路径(/huanmian3d/)部署
  base: './',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // three/R3F 体积最大且几乎不随业务代码变化,单独成 chunk 提高长期缓存命中率
        advancedChunks: {
          groups: [
            { name: 'vendor-3d', test: /node_modules[\\/](@react-three[\\/]|three[\\/])/ },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
