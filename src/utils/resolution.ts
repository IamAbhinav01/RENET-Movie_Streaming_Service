export interface Resolution {
  width: number;
  height: number;
  bitRate: number;
}

export const resolutions: Resolution[] = [
  { width: 1920, height: 1080, bitRate: 5000 }, // 1080p
  { width: 1280, height: 720, bitRate: 2500 }, // 720p
  { width: 854, height: 480, bitRate: 1500 }, // 480p
  { width: 640, height: 360, bitRate: 800 }, // 360p
  { width: 256, height: 144, bitRate: 250 }, //144p
];
