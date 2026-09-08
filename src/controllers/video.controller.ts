import { type Request, type Response } from 'express';

const uploadVideo = async (req: Request, res: Response) => {
  console.log('Hit the upload service');
  res.status();
};

export { uploadVideo };
