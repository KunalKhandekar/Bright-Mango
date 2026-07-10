import { AuthContext } from './common.types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by the `authenticate` middleware for protected routes. */
      auth?: AuthContext;
    }
  }
}

export {};
