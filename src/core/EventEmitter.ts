type Listener<T> = (data: T) => void;

export class EventEmitter<EventMap extends { [key: string]: unknown }> {
  private listeners = new Map<keyof EventMap, Set<Listener<any>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  protected emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
