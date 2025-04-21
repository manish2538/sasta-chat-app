export const config = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090',
  giphyApiKey: import.meta.env.VITE_GIPHY_API_KEY || '',
  defaultStickers: [
    { id: '1', url: '/stickers/sticker1.png' },
    { id: '2', url: '/stickers/sticker2.png' },
    { id: '3', url: '/stickers/sticker3.png' },
  ],
}; 