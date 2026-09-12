import { resolutions, type Resolution } from '../utils/resolution.js';
import fs from 'fs/promises';
import path from 'path';
// const printResolutions = (): void => {
//   resolutions.forEach((resolution: Resolution) => {
//     const width = resolution.width;
//     console.log(`${width}x${resolution.height} - ${resolution.bitRate} kbps`);
//   });
// };

// export { printResolutions };

const processVideo_for_HLS = async (
  inputPath: string,
  outputPath: string,
  callback: (error: Error | null, masterPlaylist?: string) => void
): Promise<void> => {
  try {
    await fs.mkdir(outputPath, { recursive: true });

    for (const res of resolutions) {
      fs.mkdir(path.join(outputPath, `${res.height}p`), { recursive: true });
    }

    /*
  taking one input video and scaleing it to multiple resolutions 
  [0:v] -> selects the video stream of the very first input file.
  split=5 -> creates 5 identical copies of that video stream in memory.
  [v1080][v720][v480][v360][v144] -> name these copies as 1080p,720p,..
  scale=1920:-2-> Resizes [v1080] to Full HD (1080p).
  here -2 means : Instead of forcing a strict height (like 1920:1080), -2 tells FFmpeg:
                  "Calculate the height automatically to keep the original aspect ratio,
                   but make sure the height is an even number." 
                   Most video encoders (like H.264/x264) will fail or throw errors 
                   if the video width or height is an odd number.

  */

    const filterComplex = [
      `[0:v]split=5[v1080][v720][v480][v360][v144]`,

      `[v1080]scale=1920:-2[v1080out]`,
      `[v720]scale=1280:-2[v720out]`,
      `[v480]scale=854:-2[v480out]`,
      `[v360]scale=640:-2[v360out]`,
      `[v144]scale=256:-2[v144out]`,
    ].join(';');

    //arguments need to pass down to ffmpeg before hls or adaptive bitrate processing
    const args: string[] = [
      '-i',
      inputPath,
      '-filter_complex',
      filterComplex,

      /*
       * -------------------------------------------------------
       * 1080p
       * -------------------------------------------------------
       */

      '-map',
      '[v1080out]',
      '-map',
      '0:a:0?', //-map '[v1080out]' -map '0:a:0?' -> This defines output stream pair #0
      //It grabs the video out of your custom upscale/downscale filter ,
      // and attaches the first available audio track (0:a:0).
      // The ? makes the command safe just in case the input video is completely silent (has no audio tracks)

      '-c:v:0',
      'libx264', //The :v:0 flag applies the settings to the video part of pair #0

      '-b:v:0',
      '5000k', //5000k is the recommended target bitrate for high-quality 1080p at 30 frames per second (fps).
      // It provides enough data data to prevent the video from pixelating during high-motion scenes (like sports or action).
      // 5000 kbps (or 5 Mbps).
      '-maxrate:v:0',
      '5350k',
      '-bufsize:v:0',
      '7500k', //Crucial for HLS streaming.
      //It keeps the video stream compliant to prevent spike buffering when clients stream over mobile data networks.

      '-c:a:0', //The :a:0 applies settings to the audio part of pair #0
      'aac',

      '-b:a:0',
      '128k', //128k is the industry standard for clean,
      //crisp stereo audio using the AAC codec.
      // It sounds excellent while keeping the file size lightweight.

      /*
       * -------------------------------------------------------
       * 720p
       * -------------------------------------------------------
       */

      '-map',
      '[v720out]',
      '-map',
      '0:a:0?',

      '-c:v:1',
      'libx264',

      '-b:v:1',
      '2500k',

      '-maxrate:v:1',
      '2675k',

      '-bufsize:v:1',
      '3750k',

      '-c:a:1',
      'aac',

      '-b:a:1',
      '128k',

      /*
       * -------------------------------------------------------
       * 480p
       * -------------------------------------------------------
       */

      '-map',
      '[v480out]',
      '-map',
      '0:a:0?',

      '-c:v:2',
      'libx264',

      '-b:v:2',
      '1500k',

      '-maxrate:v:2',
      '1600k',

      '-bufsize:v:2',
      '2250k',

      '-c:a:2',
      'aac',

      '-b:a:2',
      '128k',

      /*
       * -------------------------------------------------------
       * 360p
       * -------------------------------------------------------
       */

      '-map',
      '[v360out]',
      '-map',
      '0:a:0?',

      '-c:v:3',
      'libx264',

      '-b:v:3',
      '800k',

      '-maxrate:v:3',
      '856k',

      '-bufsize:v:3',
      '1200k',

      '-c:a:3',
      'aac',

      '-b:a:3',
      '128k',

      /*
       * -------------------------------------------------------
       * 144p
       * -------------------------------------------------------
       */
      '-map',
      '[v144out]',
      '-map',
      '0:a:0?',
      '-c:v:4',
      'libx264',
      '-b:v:4',
      '250k',
      '-maxrate:v:4',
      '268k',
      '-bufsize:v:4',
      '375k',
      '-c:a:4',
      'aac',
      '-b:a:4',
      '64k',
    ];
  } catch (err) {
    console.log('error occured , err : ', err);
  }
};
