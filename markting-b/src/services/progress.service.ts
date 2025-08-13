import { Injectable } from '@nestjs/common';

export interface ProcessProgress {
  currentStep: string;
  progress: number;
  totalGroups: number;
  processedGroups: number;
  currentBatch: number;
  totalBatches: number;
  isComplete: boolean;
  error?: string;
}

@Injectable()
export class ProgressService {
  // In-memory progress tracking for finish process
  private processProgress = new Map<string, ProcessProgress>();

  private getProgressKey(userId: number, apiKey: string): string {
    return `${userId}-${apiKey}`;
  }

  updateProgress(
    userId: number,
    apiKey: string,
    update: Partial<ProcessProgress>,
  ): void {
    const key = this.getProgressKey(userId, apiKey);
    const current = this.processProgress.get(key) || {
      currentStep: '',
      progress: 0,
      totalGroups: 0,
      processedGroups: 0,
      currentBatch: 0,
      totalBatches: 0,
      isComplete: false,
    };

    this.processProgress.set(key, { ...current, ...update });
  }

  getProcessProgress(userId: number, apiKey: string): ProcessProgress {
    const key = this.getProgressKey(userId, apiKey);
    return (
      this.processProgress.get(key) || {
        currentStep: 'Not started',
        progress: 0,
        totalGroups: 0,
        processedGroups: 0,
        currentBatch: 0,
        totalBatches: 0,
        isComplete: false,
      }
    );
  }

  clearProgress(userId: number, apiKey: string): void {
    const key = this.getProgressKey(userId, apiKey);
    this.processProgress.delete(key);
  }
}
