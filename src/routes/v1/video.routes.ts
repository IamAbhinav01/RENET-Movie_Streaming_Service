import express from 'express';
import { uploadVideo } from '../../controllers/video.controller.js';
import upload from '../../middleware/multer.middleware.js';

const videoRouter = express.Router();

videoRouter.post('/upload', upload.single('video'), uploadVideo);

export default videoRouter;
