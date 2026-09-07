import express, { type Request, type Response } from 'express';

const v1Router = express.Router();

v1Router.get('/ping', (req: Request, res: Response) => {
  res.send('Pong !');
});

export default v1Router;
