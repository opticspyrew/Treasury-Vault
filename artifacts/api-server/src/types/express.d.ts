// Augments Express's Request with the raw body bytes captured by the
// express.json `verify` hook in app.ts. Consumed by the Manus /sync/* signature
// check and the Netspy webhook receiver, which must verify HMAC signatures over
// the exact bytes received rather than a re-serialized body.
import "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export {};
