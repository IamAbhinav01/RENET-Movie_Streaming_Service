import express from 'express';
import videoRouter from './video.routes.js';

const v1Router = express.Router();

v1Router.use('/videos', videoRouter);

export default v1Router;
