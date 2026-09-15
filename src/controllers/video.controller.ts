import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { processVideo_for_HLS } from '../services/video_hls.services.js';
import { logger } from '../config/logger.config.js';
import {
  createJob,
  updateJob,
  getJob,
  getJobByMovieId,
} from '../utils/jobStore.js';

/**
 * POST /api/v1/videos/upload
 *
 * Accepts a video file upload and immediately returns a jobId (202 Accepted).
 * Optionally accepts a `movieId` in form-data to link the stream to the Catalog movie.
 * FFmpeg transcoding runs in the background; the job store is updated when done.
 * Poll GET /api/v1/videos/status/:jobId to track progress.
 */
const uploadVideo = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    logger.error('Failed, VIDEO_FILE_MISSING');
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
    return;
  }

  const jobId = randomUUID();
  const movieId = req.body?.movieId ? String(req.body.movieId) : undefined;
  const inputPath = req.file.path;
  const outputPath = path.resolve('src/public/output', jobId);

  // Register the job before kicking off FFmpeg
  createJob(jobId, req.file.originalname, movieId);
  updateJob(jobId, { status: 'processing' });
  logger.info(
    `Job ${jobId} created — transcoding started for: ${req.file.originalname}${movieId ? ` (movieId: ${movieId})` : ''}`
  );

  // Fire FFmpeg in the background; do NOT await — response is sent below
  processVideo_for_HLS(inputPath, outputPath, async (err, _masterPlaylist) => {
    if (err) {
      logger.error(`Job ${jobId} failed: ${err.message}`);
      updateJob(jobId, { status: 'failed', error: err.message });
      return;
    }

    // Build the public streaming URL served by express.static on /streams
    const masterPlaylistUrl = `/streams/${jobId}/master.m3u8`;
    updateJob(jobId, { status: 'done', masterPlaylistUrl });
    logger.info(`Job ${jobId} done — stream available at: ${masterPlaylistUrl}`);

    // Clean up the raw upload now that transcoding succeeded
    try {
      await fs.unlink(inputPath);
      logger.info(`Cleaned up temporary upload: ${inputPath}`);
    } catch (unlinkErr) {
      logger.warn(`Could not delete upload file ${inputPath}: ${unlinkErr}`);
    }
  });

  // Respond immediately so the client isn't left waiting for FFmpeg
  res.status(StatusCodes.ACCEPTED).json({
    success: true,
    message: 'Video accepted. Transcoding has started in the background.',
    data: {
      jobId,
      ...(movieId ? { movieId } : {}),
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      statusUrl: `/api/v1/videos/status/${jobId}`,
    },
  });
};

/**
 * GET /api/v1/videos/status/:jobId
 *
 * Returns the current status of a transcoding job.
 * When status is "done", the response includes masterPlaylistUrl.
 */
const getJobStatus = (req: Request<{ jobId: string }>, res: Response): void => {
  const { jobId } = req.params;

  if (!jobId) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'A valid jobId route parameter is required',
    });
    return;
  }

  const job = getJob(jobId);

  if (!job) {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `No job found with id: ${jobId}`,
    });
    return;
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: job,
  });
};

/**
 * GET /api/v1/videos/movie/:movieId
 *
 * Returns the stream info for a catalog movie ID (used by Catalog / Frontend).
 */
const getVideoByMovieId = (
  req: Request<{ movieId: string }>,
  res: Response
): void => {
  const { movieId } = req.params;

  if (!movieId) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'A valid movieId route parameter is required',
    });
    return;
  }

  const job = getJobByMovieId(movieId);

  if (!job) {
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `No video stream found for catalog movie id: ${movieId}`,
    });
    return;
  }

  if (job.status !== 'done' || !job.masterPlaylistUrl) {
    res.status(StatusCodes.ACCEPTED).json({
      success: true,
      message: `Video for movie ${movieId} is currently ${job.status}`,
      data: {
        jobId: job.jobId,
        movieId,
        status: job.status,
        statusUrl: `/api/v1/videos/status/${job.jobId}`,
      },
    });
    return;
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      movieId,
      jobId: job.jobId,
      status: job.status,
      streamUrl: job.masterPlaylistUrl,
    },
  });
};

export { uploadVideo, getJobStatus, getVideoByMovieId };
