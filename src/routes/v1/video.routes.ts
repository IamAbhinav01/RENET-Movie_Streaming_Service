import express from 'express';
import {
  uploadVideo,
  getJobStatus,
  getVideoByMovieId,
  getRandomUploadVideo,
  getRandomUploadStatus,
} from '../../controllers/video.controller.js';
import upload from '../../middleware/multer.middleware.js';

const videoRouter = express.Router();

videoRouter.post('/upload', upload.single('video'), uploadVideo);
videoRouter.get('/status/:jobId', getJobStatus);
videoRouter.get('/random', getRandomUploadVideo);
videoRouter.get('/random/:jobId/status', getRandomUploadStatus);
videoRouter.get('/movie/:movieId', getVideoByMovieId);

export default videoRouter;
