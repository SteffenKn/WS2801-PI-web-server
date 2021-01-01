import express from 'express';
import Http from 'http';
import {Server as SocketIo} from 'socket.io';
import uuid from 'uuid';

// tslint:disable-next-line: no-any
type ListenerFunction = (...args: Array<any>) => void;

type Listener = {
  event: string,
  callback: ListenerFunction;
};

export class SocketIoServer {
  private socketIo: SocketIo;

  private listeners: {[id: string]: Listener} = {};

  constructor(expressServer: express.Express) {
    const httpServer: Http.Server = Http.createServer(expressServer);
    this.socketIo = new SocketIo(httpServer);
  }

  // tslint:disable-next-line: no-any
  public send(event: string, data?: any): void {
    this.socketIo.emit(event, data);
  }

  public listen(event: string, callback: ListenerFunction): void {
    this.listeners[uuid.v4()] = {event: event, callback: callback};

    this.socketIo.on(event, callback);
  }

  public removeListener(id: string): void {
    const listener: Listener = this.listeners[id];

    this.socketIo.removeListener(listener.event, listener.callback);
  }
}
