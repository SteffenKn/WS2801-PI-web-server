import express from 'express';

export type ExpressMiddleware = (request: express.Request, response: express.Response, next: Function) => void;
