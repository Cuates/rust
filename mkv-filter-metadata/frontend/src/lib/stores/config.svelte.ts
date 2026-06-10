export const config = $state({
  input_directories: [] as string[],
  file_extensions: 'mkv, mp4, mov, avi, ogm, wmv',
  recursive: false,
  // ang = Old English (ISO 639-2/B), enm = Middle English — included for specific media files
  // zxx = no linguistic content (forced/signs tracks), und = undetermined
  subtitle_tracks: 'ang, eng, enm, zxx, und',
  output_extension: '.mkv',
  conversion_mode: 'remux' as 'remux' | 'reencode',
  video_codec: 'libx265' as string,
  preset: 'faster' as string,
  crf: 18 as number
});

export const appState = $state({
  isDarkMode: true,
  hardwareEncoders: {
    nvenc: false,
    amf: false,
    videotoolbox: false,
    qsv: false
  }
});
