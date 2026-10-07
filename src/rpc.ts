import type { RpcResponse } from './types';
export class WorkerClient {
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; progress?: (message: string) => void }>();
  constructor(private worker: Worker) {
    worker.onmessage = ({ data }: MessageEvent<RpcResponse>) => {
      const task = this.pending.get(data.id); if (!task) return;
      if (data.progress) { task.progress?.(data.progress); return; }
      this.pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error)); else task.resolve(data.result);
    };
    worker.onerror = () => this.rejectAll('The background task failed. Please retry.');
  }
  request<T>(action: string, payload: unknown, progress?: (message: string) => void): Promise<T> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, progress }); this.worker.postMessage({ id, action, payload }); });
  }
  private rejectAll(message: string) { this.pending.forEach(p => p.reject(new Error(message))); this.pending.clear(); }
  terminate() { this.worker.terminate(); this.rejectAll('Cancelled.'); }
}
