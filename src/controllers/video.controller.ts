import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

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
    const path = req.file.path;
    return res.status(StatusCodes.ACCEPTED).json({
      success: true,
      error: {},
      message: 'Succesfully file was uploaded',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: path,
      },
    });
  }
};

export { uploadVideo };
