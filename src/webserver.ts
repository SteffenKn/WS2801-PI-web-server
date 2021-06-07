import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import Http from 'http';

import {Logger} from './logger';
import {ExpressCallback, ExpressMiddleware} from './types/index';

const logger: Logger = new Logger('Webserver');

export class Webserver {
  private server: express.Express;
  private httpServer: Http.Server;

  private port: number;
  private logRequests: boolean;

  constructor(port: number, logRequests: boolean) {
    this.port = port;
    this.logRequests = logRequests;

    this.server = express();
    this.server.use(bodyParser.json());
    this.server.use(cors());

    this.httpServer = Http.createServer(this.server);
  }

  public start(): void {
    this.httpServer.listen(this.port, (): void => {
      logger.log(`listening on port ${this.port}!`);
    });
  }

  public stop(): void {
    this.httpServer.close();
  }

  public getHttpServer(): Http.Server {
    return this.httpServer;
  }

  public getExpressServer(): express.Express {
    return this.server;
  }

  public addMiddleware(middleware: ExpressMiddleware): void {
    this.server.use(middleware);
  }

  public addPostRoute(route: string, callback: ExpressCallback): void {
    const callbackWithLogging: ExpressCallback = (request: express.Request, response: express.Response): void => {
      if (this.logRequests) {
        logger.log(`Requested (post) route '${route}' with body '${JSON.stringify(request.body, null, 2)}' with query params '${JSON.stringify(request.query, null, 2)}'.`);
      }

      callback(request, response);
    };

    this.server.post(route, callbackWithLogging);
  }

  public addGetRoute(route: string, callback: ExpressCallback): void {
    const callbackWithLogging: ExpressCallback = (request: express.Request, response: express.Response): void => {
      if (this.logRequests) {
        logger.log(`Requested (get) route '${route}' with query params '${JSON.stringify(request.query, null, 2)}'.`);
      }

      callback(request, response);
    };

    this.server.get(route, callbackWithLogging);
  }
  public addDeleteRoute(route: string, callback: ExpressCallback): void {
    const callbackWithLogging: ExpressCallback = (request: express.Request, response: express.Response): void => {
      if (this.logRequests) {
        logger.log(`Requested (delete) route '${route}' with query params '${JSON.stringify(request.query, null, 2)}'.`);
      }

      callback(request, response);
    };

    this.server.delete(route, callbackWithLogging);
  }
}
