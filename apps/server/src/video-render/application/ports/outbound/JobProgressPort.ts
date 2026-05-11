export interface JobProgressPort {
	setProgress(jobId: string, progress: number): Promise<void>;
	getProgress(jobId: string): Promise<number | null>;
	deleteProgress(jobId: string): Promise<void>;
}
