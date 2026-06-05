export type FileStat = {
  name: string;
  size_bytes: number;
};

export type DirStats = {
  exists: boolean;
  file_count: number;
  total_size_bytes: number;
  files: FileStat[];
};
