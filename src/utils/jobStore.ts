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
 * Retrieve a job by catalog movieId. Returns undefined if not found.
 */
const getJobByMovieId = (movieId: string): Job | undefined => {
  const jobId = movieToJobMap.get(movieId);
  if (!jobId) return undefined;
  return jobs.get(jobId);
};

export { createJob, updateJob, getJob, getJobByMovieId };
