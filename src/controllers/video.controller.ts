import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const uploadVideo = async (req: Request, res: Response) => {
  console.log('Hit the upload service');
  console.log('data of req', req);
  res.status(StatusCodes.OK).json({ message: 'Hit the upload service' });
};

export { uploadVideo };
