import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';

import {Logger} from './logger';
import {ExpressCallback, ExpressMiddleware} from './types/index';

const logger: Logger = new Logger('Webserver');

export class Webserver {
  private server: express.Express;

  private port: number;

  constructor(port: number) {
    this.port = port;
    this.server = express();

    this.server.use(bodyParser.json());
    this.server.use(cors());
  }

  public start(): void {
    this.initializeWebserver();
  }

  private initializeWebserver(): void {
    this.server.listen(this.port, (): void => {
      logger.log(`listening on port ${this.port}!`);
    });
  }

  public addMiddleware(middleware: ExpressMiddleware): void {
    this.server.use(middleware);
  }

  public addPostRoute(route: string, callback: ExpressCallback): void {
    const callbackWithLogging: ExpressCallback = (request: express.Request, response: express.Response): void => {
      logger.log(`Requested (post) route '${route}' with body '${JSON.stringify(request.body, null, 2)}' with query params '${JSON.stringify(request.query, null, 2)}'.`);

      callback(request, response);
    };

    this.server.post(route, callbackWithLogging);
  }

  public addGetRoute(route: string, callback: ExpressCallback): void {
    const callbackWithLogging: ExpressCallback = (request: express.Request, response: express.Response): void => {
      logger.log(`Requested (get) route '${route}' with query params '${JSON.stringify(request.query, null, 2)}'.`);

      callback(request, response);
    };

    this.server.get(route, callbackWithLogging);
  }
  public addDeleteRoute(route: string, callback: ExpressCallback): void {
    const callbackWithLogging: ExpressCallback = (request: express.Request, response: express.Response): void => {
      logger.log(`Requested (delete) route '${route}' with query params '${JSON.stringify(request.query, null, 2)}'.`);

      callback(request, response);
    };

    this.server.delete(route, callbackWithLogging);
  }
}
