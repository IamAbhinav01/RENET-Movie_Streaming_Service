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
    `[0:v]split=5`,
    `[v1080][v720][v480][v360][v144]`,

    `[v1080]scale=1920:-2[v1080out]`,
    `[v720]scale=1280:-2[v720out]`,
    `[v480]scale=854:-2[v480out]`,
    `[v360]scale=640:-2[v360out]`,
    `[v144]scale=256:-2[v144out]`,
  ].join(';');
};
