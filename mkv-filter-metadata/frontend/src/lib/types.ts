import { z } from 'zod';

const FileStatSchema = z.object({
  name: z.string(),
  size_bytes: z.number()
});

export const DirStatsSchema = z.object({
  exists: z.boolean(),
  file_count: z.number(),
  total_size_bytes: z.number(),
  files: z.array(FileStatSchema)
});

export const EncoderCapabilitiesSchema = z.object({
  nvenc: z.boolean(),
  amf: z.boolean(),
  qsv: z.boolean(),
  videotoolbox: z.boolean()
});

export type DirStats = z.infer<typeof DirStatsSchema>;
