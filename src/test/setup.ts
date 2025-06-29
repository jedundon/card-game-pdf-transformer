// Vitest setup file
import { vi } from 'vitest'

// Mock Canvas API for Node.js environment
const mockCanvas = {
  getContext: vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  })),
  toDataURL: vi.fn(() => 'data:image/png;base64,test'),
  toBlob: vi.fn(),
  width: 300,
  height: 300,
}

global.HTMLCanvasElement = vi.fn(() => mockCanvas) as any
global.CanvasRenderingContext2D = vi.fn() as any

// Mock Image constructor
global.Image = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  src: '',
  onload: null,
  onerror: null,
  width: 100,
  height: 100,
})) as any

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()