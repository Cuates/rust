import { describe, it, expect } from 'vitest';
import { DirectoryStatsSchema, EncoderCapabilitiesSchema, PipelineSummarySchema } from './types';

describe('Zod Schemas', () => {
  describe('DirectoryStatsSchema', () => {
    it('validates a correct DirectoryStats object', () => {
      const validData = {
        exists: true,
        file_count: 2,
        total_size_bytes: 1000,
        history_skipped_count: 0,
        history_skipped_bytes: 0,
        files: [
          { name: 'file1.mkv', size_bytes: 512 },
          { name: 'file2.mkv', size_bytes: 512 }
        ]
      };

      const result = DirectoryStatsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid DirectoryStats object', () => {
      const invalidData = {
        exists: 'yes', // should be boolean
        file_count: 2,
        total_size_bytes: 1000,
        history_skipped_count: 0,
        history_skipped_bytes: 0,
        files: []
      };

      const result = DirectoryStatsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects invalid nested file objects', () => {
      const invalidData = {
        exists: true,
        file_count: 1,
        total_size_bytes: 1000,
        history_skipped_count: 0,
        history_skipped_bytes: 0,
        files: [
          { name: 'file1.mkv', size: 512 } // missing size_bytes
        ]
      };

      const result = DirectoryStatsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('EncoderCapabilitiesSchema', () => {
    it('validates a correct EncoderCapabilities object', () => {
      const validData = {
        nvenc: true,
        amf: false,
        qsv: true,
        videotoolbox: false
      };

      const result = EncoderCapabilitiesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const invalidData = {
        nvenc: true,
        amf: false,
        qsv: true
        // videotoolbox is missing
      };

      const result = EncoderCapabilitiesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('PipelineSummarySchema', () => {
    it('validates a correct PipelineSummary object', () => {
      const validData = {
        message: 'Completed',
        original_size_bytes: 5000,
        output_size_bytes: 2500,
        skipped_files: 1
      };

      const result = PipelineSummarySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid PipelineSummary object', () => {
      const invalidData = {
        message: 'Completed',
        original_size_bytes: '5000', // should be number
        output_size_bytes: 2500,
        skipped_files: 1
      };

      const result = PipelineSummarySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
