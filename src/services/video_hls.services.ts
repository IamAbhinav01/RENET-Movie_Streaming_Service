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
};
