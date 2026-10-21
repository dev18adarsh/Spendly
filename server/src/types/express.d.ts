declare global {
  namespace Express {
    interface Request {
      /**
       * Output of the request validation middleware.
       * Populated per source so controllers never touch unvalidated input.
       */
      validated: {
        body?: unknown
        query?: unknown
        params?: unknown
      }
    }
  }
}

export {}
