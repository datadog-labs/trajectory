export type AsyncQueueTask = () => void | Promise<void>;

export interface AsyncQueueSnapshot {
	capacity: number;
	depth: number;
	pending: number;
	running: boolean;
	dropped: number;
}
/**
 * A bounded, serialized queue for best-effort extension work.
 *
 * Admission never starts work inline with a Pi callback. At most one task is
 * running and the total running + pending depth never exceeds capacity.
 */
export class BoundedSerialQueue {
	readonly capacity: number;
	private readonly tasks: AsyncQueueTask[] = [];
	private running = false;
	private scheduled = false;
	private dropped = 0;
	private readonly idleWaiters = new Set<() => void>();

	constructor(capacity: number) {
		if (!Number.isSafeInteger(capacity) || capacity < 1) {
			throw new Error("queue capacity must be a positive integer");
		}
		this.capacity = capacity;
	}

	enqueue(task: AsyncQueueTask): boolean {
		if (this.depth() >= this.capacity) {
			this.dropped++;
			return false;
		}
		this.tasks.push(task);
		this.schedule();
		return true;
	}

	/** Admit terminal work by replacing the newest pending item when full. */
	enqueueTerminal(task: AsyncQueueTask): boolean {
		if (this.depth() < this.capacity) return this.enqueue(task);
		if (this.tasks.length === 0) {
			this.dropped++;
			return false;
		}
		this.tasks.pop();
		this.dropped++;
		this.tasks.push(task);
		return true;
	}

	snapshot(): AsyncQueueSnapshot {
		return {
			capacity: this.capacity,
			depth: this.depth(),
			pending: this.tasks.length,
			running: this.running,
			dropped: this.dropped,
		};
	}

	async drain(timeoutMs: number): Promise<boolean> {
		if (this.depth() === 0) return true;
		if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return false;

		return await new Promise<boolean>((resolve) => {
			let settled = false;
			const finish = (drained: boolean) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				this.idleWaiters.delete(onIdle);
				resolve(drained);
			};
			const onIdle = () => finish(true);
			const timer = setTimeout(() => finish(false), timeoutMs);
			this.idleWaiters.add(onIdle);
		});
	}

	private depth(): number {
		return this.tasks.length + (this.running ? 1 : 0);
	}

	private schedule(): void {
		if (this.running || this.scheduled || this.tasks.length === 0) return;
		this.scheduled = true;
		setTimeout(() => {
			this.scheduled = false;
			void this.runNext();
		}, 0);
	}

	private async runNext(): Promise<void> {
		if (this.running) return;
		const task = this.tasks.shift();
		if (!task) {
			this.notifyIdle();
			return;
		}

		this.running = true;
		try {
			await task();
		} catch {
			// Capture is best-effort; one failed task must not poison the queue.
		} finally {
			this.running = false;
			if (this.tasks.length === 0) this.notifyIdle();
			else this.schedule();
		}
	}

	private notifyIdle(): void {
		if (this.depth() !== 0) return;
		for (const waiter of this.idleWaiters) waiter();
		this.idleWaiters.clear();
	}
}
