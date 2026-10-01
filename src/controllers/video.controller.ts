import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { processVideo_for_HLS } from '../services/video_hls.services.js';
import { logger } from '../config/logger.config.js';
import {
  createJob,
  updateJob,
  getJob,
  getJobByMovieId,
  getAvailableMovieIds,
} from '../utils/jobStore.js';

const uploadsDirectory = path.resolve('src/public/data/uploads');
const randomOutputDirectory = path.resolve('src/public/output/random');
const transcodeTasks = new Map<string, Promise<void>>();
const transcodeFailures = new Map<string, string>();
const videoExtensions = new Set([
  '.avi',
  '.mkv',
  '.mov',
  '.mp4',
  '.m4v',
  '.webm',
]);

const startRandomUploadTranscode = async (
  fileName: string
): Promise<{ jobId: string; streamUrl: string; ready: boolean }> => {
  const inputPath = path.join(uploadsDirectory, fileName);
  const fileStats = await fs.stat(inputPath);
  const cacheKey = createHash('sha256')
    .update(`${fileName}:${fileStats.size}:${fileStats.mtimeMs}`)
    .digest('hex');
  const outputPath = path.join(randomOutputDirectory, cacheKey);
  const masterPlaylist = path.join(outputPath, 'master.m3u8');
  const streamUrl = `/streams/random/${cacheKey}/master.m3u8`;

  try {
    await fs.access(masterPlaylist);
    return { jobId: cacheKey, streamUrl, ready: true };
  } catch {}

  transcodeFailures.delete(cacheKey);
  let task = transcodeTasks.get(cacheKey);
  if (!task) {
    task = (async () => {
      await fs.mkdir(outputPath, { recursive: true });
      await new Promise<void>((resolve, reject) => {
        void processVideo_for_HLS(inputPath, outputPath, (error) =>
          error ? reject(error) : resolve()
        );
      });
    })();
    transcodeTasks.set(cacheKey, task);
    void task.then(
      () => {
        if (transcodeTasks.get(cacheKey) === task) {
          transcodeTasks.delete(cacheKey);
        }
      },
      (error: unknown) => {
        transcodeFailures.set(
          cacheKey,
          error instanceof Error ? error.message : String(error)
        );
        if (transcodeTasks.get(cacheKey) === task) {
          transcodeTasks.delete(cacheKey);
        }
      }
    );
  }

  return { jobId: cacheKey, streamUrl, ready: false };
};

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

  const inputPath = req.file.path;
  const submittedMovieId = req.body?.movieId;
  const movieId = submittedMovieId ? String(submittedMovieId).trim() : undefined;
  if (movieId && !/^[1-9]\d*$/.test(movieId)) {
    await fs.unlink(inputPath).catch(() => undefined);
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'movieId must be a positive integer',
    });
    return;
  }

  const jobId = randomUUID();
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
    logger.info(
      `Job ${jobId} done — stream available at: ${masterPlaylistUrl}`
    );

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
const getVideoByMovieId = async (
  req: Request<{ movieId: string }>,
  res: Response
): Promise<void> => {
  const { movieId } = req.params;

  if (!/^[1-9]\d*$/.test(movieId)) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'movieId must be a positive integer',
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

  const masterPlaylistPath = path.resolve(
    'src/public/output',
    job.jobId,
    'master.m3u8'
  );
  try {
    await fs.access(masterPlaylistPath);
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        movieId,
        jobId: job.jobId,
        status: job.status,
        streamUrl: job.masterPlaylistUrl || `/streams/${job.jobId}/master.m3u8`,
      },
    });
    return;
  } catch {}

  if (job.status === 'failed') {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: job.error || `Video for movie ${movieId} failed to transcode`,
    });
    return;
  }

  if (job.status !== 'done') {
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

  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: `No playable stream exists for movie ${movieId}`,
  });
};

const getMovieVideoAvailability = (req: Request, res: Response): void => {
  const movieIds: unknown = req.body?.movieIds;
  if (
    !Array.isArray(movieIds) ||
    movieIds.length > 100 ||
    movieIds.some(
      (movieId) =>
        !Number.isSafeInteger(movieId) || Number(movieId) <= 0
    )
  ) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'movieIds must be an array of up to 100 positive integers',
    });
    return;
  }

  const availableMovieIds = getAvailableMovieIds(
    (movieIds as number[]).map(String)
  ).map(Number);
  res.status(StatusCodes.OK).json({
    success: true,
    data: { movieIds: availableMovieIds },
  });
};

const getRandomUploadVideo = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const files = await fs.readdir(uploadsDirectory, { withFileTypes: true });
    const candidates = files.filter(
      (file) =>
        file.isFile() &&
        videoExtensions.has(path.extname(file.name).toLowerCase())
    );

    if (candidates.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'No video files are available in the uploads directory',
      });
      return;
    }

    const selected = candidates[0];
    if (!selected) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'No video files are available in the uploads directory',
      });
      return;
    }

    const stream = await startRandomUploadTranscode(selected.name);
    res.status(stream.ready ? StatusCodes.OK : StatusCodes.ACCEPTED).json({
      success: true,
      data: {
        fileName: selected.name,
        ...(stream.ready ? { streamUrl: stream.streamUrl } : {}),
        status: stream.ready ? 'ready' : 'processing',
        ...(!stream.ready
          ? { statusUrl: `/api/v1/videos/random/${stream.jobId}/status` }
          : {}),
      },
    });
  } catch (error) {
    logger.error(`Unable to select an uploaded video: ${error}`);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Unable to prepare a video from the uploads directory',
    });
  }
};

const getRandomUploadStatus = async (
  req: Request<{ jobId: string }>,
  res: Response
): Promise<void> => {
  const { jobId } = req.params;
  if (!/^[a-f0-9]{64}$/.test(jobId)) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid transcode job ID',
    });
    return;
  }

  const streamUrl = `/streams/random/${jobId}/master.m3u8`;
  try {
    await fs.access(path.join(randomOutputDirectory, jobId, 'master.m3u8'));
    res.status(StatusCodes.OK).json({
      success: true,
      data: { status: 'ready', streamUrl },
    });
    return;
  } catch {}

  const failure = transcodeFailures.get(jobId);
  if (failure) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      data: { status: 'failed' },
      message: `Video transcode failed: ${failure}`,
    });
    return;
  }

  if (transcodeTasks.has(jobId)) {
    res.status(StatusCodes.ACCEPTED).json({
      success: true,
      data: { status: 'processing' },
    });
    return;
  }

  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: 'Transcode job not found',
  });
};

export {
  uploadVideo,
  getJobStatus,
  getVideoByMovieId,
  getMovieVideoAvailability,
  getRandomUploadVideo,
  getRandomUploadStatus,
};
