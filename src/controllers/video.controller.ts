import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs/promises';
import path from 'path';
import { processVideo_for_HLS } from '../services/video_hls.services.js';

const uploadVideo = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'VIDEO_FILE_MISSING',
        type: 'ValidationError',
        field: 'video',
      },
      message: 'No video file was uploaded',
      data: {},
    });
  } else {
    const inputPath = req.file.path;
    const outputPath = path.resolve('src/public/output', `${Date.now()}`);

    processVideo_for_HLS(inputPath, outputPath, (err, masterPlaylist) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'an error occured while processing the video',
        });
      }
      fs.unlink(inputPath);
    });

    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      error: {},
      message: 'Succesfully file was uploaded',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: inputPath,
      },
    });
  }
};

export { uploadVideo };
