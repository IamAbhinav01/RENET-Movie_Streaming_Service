import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { processVideo_for_HLS } from '../services/video_hls.services.js';
import { logger } from '../config/logger.config.js';

const uploadVideo = async (req: Request, res: Response) => {
  if (!req.file) {
    logger.error(`Failed, VIDEO_FILE_MISSING`);
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
    const outputPath = path.resolve('src/public/output', `${randomUUID()}`);
    logger.info(`succefully sent file to service layer for processing`);
    processVideo_for_HLS(inputPath, outputPath, (err, masterPlaylist) => {
      if (err) {
        logger.error(`an error occured while processing the video : ${err}`);
        return res.status(500).json({
          success: false,
          message: 'an error occured while processing the video',
        });
      }
      fs.unlink(inputPath);
    });
    logger.info('Succesfully file was uploaded');
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
