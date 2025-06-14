/**
 * Setup utilities for pipeline tests
 */

import { jest } from '@jest/globals';
import type { TransformationStep, CardData, WorkflowSettings, ValidationResult, PreviewData } from '../types';

// Mock PDF worker for tests
export const mockPdfWorker = {
  getDocument: jest.fn(),
  GlobalWorkerOptions: {
    workerSrc: 'mock-worker.js',
  },
};

// Test data factories
export const createMockCardData = (overrides = {}) => ({
  id: `card-${Math.random()}`,
  x: 0,
  y: 0,
  width: 100,
  height: 140,
  rotation: 0,
  selected: false,
  extracted: false,
  ...overrides,
});

export const createMockSettings = (overrides = {}) => ({
  inputMode: 'pdf' as const,
  outputFormat: 'individual' as const,
  dpi: 300,
  quality: 0.8,
  gridColumns: 3,
  gridRows: 3,
  cardWidth: 63,
  cardHeight: 88,
  bleed: 0,
  ...overrides,
});

export const createMockPreviewData = (overrides = {}) => ({
  imageUrl: 'data:image/png;base64,mock',
  thumbnailUrl: 'data:image/png;base64,thumb',
  metadata: {
    width: 300,
    height: 420,
    dpi: 300,
  },
  ...overrides,
});

// Performance testing utilities
export const measurePerformance = async (fn: () => Promise<any>) => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

// Mock implementations for components
export const createMockPipelineStep = (id: string): TransformationStep => ({
  id,
  name: `Mock Step ${id}`,
  description: `Mock description for step ${id}`,
  execute: jest.fn<(input: CardData[], settings: WorkflowSettings) => Promise<CardData[]>>(),
  generatePreview: jest.fn<(input: CardData[], settings: WorkflowSettings) => Promise<PreviewData>>(),
  validate: jest.fn<(settings: WorkflowSettings) => ValidationResult>(),
});

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Basic test to make Jest happy
describe('Setup utilities', () => {
  it('should create mock card data', () => {
    const cardData = createMockCardData();
    expect(cardData).toHaveProperty('id');
    expect(cardData).toHaveProperty('x', 0);
    expect(cardData).toHaveProperty('y', 0);
  });

  it('should create mock settings', () => {
    const settings = createMockSettings();
    expect(settings.inputMode).toBe('pdf');
    expect(settings.dpi).toBe(300);
  });

  it('should create mock preview data', () => {
    const preview = createMockPreviewData();
    expect(preview.imageUrl).toContain('data:image/png');
    expect(preview.metadata.dpi).toBe(300);
  });
});
