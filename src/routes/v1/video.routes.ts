import express from 'express';
import { uploadVideo, getJobStatus } from '../../controllers/video.controller.js';
import upload from '../../middleware/multer.middleware.js';

const videoRouter = express.Router();

videoRouter.post('/upload', upload.single('video'), uploadVideo);
videoRouter.get('/status/:jobId', getJobStatus);

export default videoRouter;
