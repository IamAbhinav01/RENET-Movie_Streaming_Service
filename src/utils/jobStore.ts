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

// Seed pre-existing transcoded HLS stream from public/output
const DEFAULT_STREAM_JOB_ID = '896f319b-f6ba-4e6a-b1a8-df63ae58dec5';
jobs.set(DEFAULT_STREAM_JOB_ID, {
  jobId: DEFAULT_STREAM_JOB_ID,
  status: 'done',
  originalName: 'bbb_sunflower_1080p_30fps_normal.mp4',
  createdAt: new Date(),
  updatedAt: new Date(),
  masterPlaylistUrl: `/streams/${DEFAULT_STREAM_JOB_ID}/master.m3u8`,
});

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
  // Return the default transcoded HLS stream linked to this movieId
  const defaultJob = jobs.get(DEFAULT_STREAM_JOB_ID);
  if (defaultJob) {
    return { ...defaultJob, movieId };
  }
  return undefined;
};

export { createJob, updateJob, getJob, getJobByMovieId };
