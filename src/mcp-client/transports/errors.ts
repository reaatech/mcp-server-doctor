export class TransportError extends Error {
  constructor(
    message: string,
    public readonly rpcCode?: number,
    public readonly rpcData?: unknown,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}
