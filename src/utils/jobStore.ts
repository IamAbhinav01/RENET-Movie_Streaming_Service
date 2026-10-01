import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import path from 'path';

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface Job {
  jobId: string;
  status: JobStatus;
  originalName: string;
  createdAt: Date;
  updatedAt: Date;
  movieId?: string;
  masterPlaylistUrl?: string;
  error?: string;
}

const jobs = new Map<string, Job>();
const movieToJobMap = new Map<string, string>();
const jobStorePath = path.resolve('src/data/video-jobs.json');

const persistJobs = (): void => {
  mkdirSync(path.dirname(jobStorePath), { recursive: true });
  const temporaryPath = `${jobStorePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify([...jobs.values()]), 'utf8');
  renameSync(temporaryPath, jobStorePath);
};

const loadJobs = (): void => {
  let storedJobs: Array<Job & { createdAt: string; updatedAt: string }>;
  try {
    storedJobs = JSON.parse(readFileSync(jobStorePath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  let changed = false;
  for (const storedJob of storedJobs) {
    const job: Job = {
      ...storedJob,
      createdAt: new Date(storedJob.createdAt),
      updatedAt: new Date(storedJob.updatedAt),
    };
    if (
      job.status === 'processing' &&
      !existsSync(
        path.resolve('src/public/output', job.jobId, 'master.m3u8')
      )
    ) {
      job.status = 'failed';
      job.error = 'Transcoding was interrupted by a service restart';
      changed = true;
    }
    jobs.set(job.jobId, job);
    if (job.movieId) movieToJobMap.set(job.movieId, job.jobId);
  }

  if (changed) persistJobs();
};

loadJobs();

/**
 * Create and register a new transcoding job.
 */
const createJob = (
  jobId: string,
  originalName: string,
  movieId?: string
): Job => {
  const job: Job = {
    jobId,
    status: 'pending',
    originalName,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(movieId ? { movieId } : {}),
  };
  jobs.set(jobId, job);

  if (movieId) {
    movieToJobMap.set(movieId, jobId);
  }

  persistJobs();
  return job;
};

/**
 * Partially update a job by id (updatedAt is always refreshed).
 */
const updateJob = (
  jobId: string,
  update: Partial<Omit<Job, 'jobId' | 'createdAt'>>
): void => {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, { ...update, updatedAt: new Date() });
    persistJobs();
  }
};

/**
 * Retrieve a job by id. Returns undefined if not found.
 */
const getJob = (jobId: string): Job | undefined => jobs.get(jobId);

/**
 * Retrieve a job by catalog movieId. Falls back to default HLS stream if not explicitly mapped.
 */
const getJobByMovieId = (movieId: string): Job | undefined => {
  const jobId = movieToJobMap.get(movieId);
  if (jobId && jobs.has(jobId)) {
    return jobs.get(jobId);
  }
  return undefined;
};

const getAvailableMovieIds = (movieIds: string[]): string[] =>
  movieIds.filter((movieId) => {
    const jobId = movieToJobMap.get(movieId);
    const job = jobId ? jobs.get(jobId) : undefined;
    return Boolean(
      job &&
        job.status !== 'failed' &&
        (job.status === 'processing' ||
          existsSync(
            path.resolve('src/public/output', job.jobId, 'master.m3u8')
          ))
    );
  });

export {
  createJob,
  updateJob,
  getJob,
  getJobByMovieId,
  getAvailableMovieIds,
};
