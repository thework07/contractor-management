import 'mongoose';

declare module 'mongoose' {
  interface Connection {
    removeDb(name: string): void;
  }
}
