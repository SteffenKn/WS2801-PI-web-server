import express from 'express';

export type ExpressCallback = (request: express.Request, response: express.Response) => void;
