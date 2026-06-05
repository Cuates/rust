export const config = $state({
  input_directories: [] as string[],
  file_extensions: 'mkv, mp4, mov, avi, ogm, wmv',
  subtitle_tracks: 'ang, eng, enm, zxx, und',
  output_extension: '.mkv',
  conversion_mode: 'remux',
  video_codec: 'libx265',
  preset: 'faster',
  crf: '18'
});

export const appState = $state({
  isDarkMode: true,
  hasNvidia: false
});
