import express from 'express';
import { uploadVideo } from '../../controllers/video.controller.js';

const videoRouter = express.Router();

videoRouter.post('/upload', uploadVideo);

export default videoRouter;
