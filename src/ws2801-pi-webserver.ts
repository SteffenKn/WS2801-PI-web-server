import {ChildProcess, fork} from 'child_process';
import express from 'express';
import path from 'path';

import LedController, {LedColor, LedStrip} from 'ws2801-pi';

import {AuthService} from './auth-service';
import {Config as DefaultConfig} from './config/config';
import {validateLedStrip} from './led-strip-validation';
import {SocketIoServer} from './socket-io-server';
import {Webserver} from './webserver';

import {Ws2801PiWebserverConfig} from './types';

export class Ws2801PiWebserver {
  private ledController: LedController;
  private webserver: Webserver;
  private socketIoServer: SocketIoServer;
  private authService: AuthService;

  private config: Ws2801PiWebserverConfig;

  private currentAnimationProcess: ChildProcess;

  constructor(config?: Ws2801PiWebserverConfig, ledController?: LedController) {
    this.config = config ? config : DefaultConfig;

    if (!ledController && ! this.config.amountOfLeds) {
      throw new Error(`Either a ledController must be provided or the amount of leds must be provided via config!`);
    }

    this.ledController = ledController ? ledController : new LedController(this.config.amountOfLeds);
    this.webserver = new Webserver(this.config.port);
    this.authService = new AuthService(this.webserver);

    if (this.config.useSocketIo) {
      this.socketIoServer = new SocketIoServer(this.webserver.getExpressServer());
    }
  }

  public start(): void {
    this.addRoutes();
    // this.addSocketIoListeners();
    this.addSocketIoEmitters();

    this.webserver.start();

    if (this.config.useAuth) {
     this. authService.start();
    }
  }

  public getLedController(): LedController {
    return this.ledController;
  }

  public getExpressServer(): express.Express {
    return this.webserver.getExpressServer();
  }

  private addRoutes(): void {
    this.webserver.addGetRoute('/login-required', this.loginRequired.bind(this));
    this.webserver.addGetRoute('/led-strip', this.getLedStrip.bind(this));
    this.webserver.addPostRoute('/led-strip/fill', this.fillLedStrip.bind(this));
    this.webserver.addPostRoute('/led-strip/clear', this.clearLedStrip.bind(this));
    this.webserver.addPostRoute('/led-strip/led/:ledIndex/set', this.setSingleLedColor.bind(this));
    this.webserver.addPostRoute('/led-strip/brightness/set', this.setBrightness.bind(this));
    this.webserver.addGetRoute('/led-strip/brightness', this.getBrightness.bind(this));
    this.webserver.addPostRoute('/led-strip/set', this.setLedStrip.bind(this));
    this.webserver.addPostRoute('/led-strip/animation/start', this.startAnimation.bind(this));
    this.webserver.addDeleteRoute('/led-strip/animation/stop', this.stopAnimation.bind(this));
    this.webserver.addGetRoute('/led-strip/animation/finished', this.waitForAnimationToFinish.bind(this));
  }

  // private addSocketIoListeners(): void {
  // }

  private addSocketIoEmitters(): void {
    this.ledController.onLedStripChanged((ledStrip: LedStrip): void => {
      this.socketIoServer.send('led-strip__changed', ledStrip);
    });

    this.ledController.onBrightnessChanged((brightness: number): void => {
      this.socketIoServer.send('brightness__changed', brightness);
    });
  }

  // Route functions

  private loginRequired(_: express.Request, response: express.Response): void {
    response.status(200).json({loginRequired: this.config.useAuth});
  }

  private async getLedStrip(_: express.Request, response: express.Response): Promise<void> {
    if (this.currentAnimationProcess) {
      await new Promise((resolve: Function): void => {
        const eventCallback: (message: any) => void = (receivedLedStrip: LedStrip): void => {
          response.status(200).json({ledStrip: receivedLedStrip});

          resolve();
        };

        this.currentAnimationProcess.on('message', eventCallback);

        this.currentAnimationProcess.send({action: 'get-led-strip'});
      });

      return;
    }

    const ledStrip: LedStrip = this.ledController.getLedStrip();

    response.status(200).json({ledStrip: ledStrip});
  }

  private async fillLedStrip(request: express.Request, response: express.Response): Promise<void> {
    const color: LedColor = request.body.color;

    if (!color) {
      response.status(400).send(`Request body must contain a 'color', e.g. {red: 255, green: 0, blue: 0}.`);

      return;
    }

    await this.ledController.fillLeds(color).show();

    const ledStrip: LedStrip = this.ledController.getLedStrip();

    if (this.config.useSocketIo) {
      this.socketIoServer.send('led-strip-changed', {ledStrip: ledStrip});
    }

    response.status(200).json({ledStrip: ledStrip});
  }

  private async clearLedStrip(request: express.Request, response: express.Response): Promise<void> {
    await this.ledController.clearLeds().show();

    const ledStrip: LedStrip = this.ledController.getLedStrip();

    if (this.config.useSocketIo) {
      this.socketIoServer.send('led-strip-changed', {ledStrip: ledStrip});
    }

    response.status(200).json({ledStrip: ledStrip});
  }

  private async setSingleLedColor(request: express.Request, response: express.Response): Promise<void> {
    const enteredLedIndex: string = request.params.ledIndex;
    const ledIndex: number = parseInt(enteredLedIndex);

    const color: LedColor = request.body.color;

    if (Number.isNaN(ledIndex) || ledIndex < 0 || ledIndex >= this.config.amountOfLeds) {
      response.status(400).send(`URL must contain a led index between 0 and ${this.config.amountOfLeds - 1} (Received ${enteredLedIndex}).`);

      return;
    }

    if (!color) {
      response.status(400).send(`Request body must contain a 'color', e.g. {red: 255, green: 0, blue: 0}.`);

      return;
    }

    await this.ledController.setLed(ledIndex, color).show();

    const ledStrip: LedStrip = this.ledController.getLedStrip();

    if (this.config.useSocketIo) {
      this.socketIoServer.send('led-strip-changed', {ledStrip: ledStrip});
    }

    response.status(200).json({ledStrip: ledStrip});
  }

  private async setBrightness(request: express.Request, response: express.Response): Promise<void> {
    const brightness: number | 'auto' = request.body.brightness;

    if (brightness == undefined || (typeof brightness !== 'number' && brightness !== 'auto') || brightness < 0 || brightness > 100) {
      response.status(400).send(`Request body must contain a 'brightness' (number between 0 and 100 or 'auto' for automatic brightness).`);

      return;
    }

    await this.ledController.setBrightness(brightness).show();

    if (this.currentAnimationProcess) {
      this.currentAnimationProcess.send({action: 'set-brightness', brightness: brightness});
    }

    if (this.config.useSocketIo) {
      this.socketIoServer.send('brightness-changed', {brightness: brightness});
    }

    response.status(200).send('success');
  }

  private async getBrightness(request: express.Request, response: express.Response): Promise<void> {
    const brightness: number | 'auto' = this.ledController.getBrightness();

    response.status(200).json({brightness: brightness});
  }

  private async setLedStrip(request: express.Request, response: express.Response): Promise<void> {
    const ledStrip: LedStrip = request.body.ledStrip;

    if (!ledStrip) {
      response.status(400).send(`Request body must contain a 'ledStrip' (an array of LedColors with the length of the led strip).`);

      return;
    }

    try {
      validateLedStrip(this.ledController.getLedStrip().length, ledStrip);
    } catch (error) {
      response.status(400).send(error.message);

      return;
    }

    for (let ledIndex: number = 0; ledIndex < ledStrip.length; ledIndex++) {
      this.ledController.setLed(ledIndex, ledStrip[ledIndex]);
    }

    await this.ledController.show();

    const renderedLedStrip: LedStrip = this.ledController.getLedStrip();

    if (this.config.useSocketIo) {
      this.socketIoServer.send('led-strip-changed', {ledStrip: renderedLedStrip});
    }

    response.status(200).json({ledStrip: renderedLedStrip});
  }

  private async startAnimation(request: express.Request, response: express.Response): Promise<void> {
    const animationScript: string = request.body.animationScript;

    if (animationScript == undefined) {
      response.status(400).send(`Request body must contain a 'animationScript'.`);

      return;
    }

    if (this.currentAnimationProcess) {
      this.currentAnimationProcess.kill();
      this.currentAnimationProcess = undefined;
    }

    const brightness: number | 'auto' = this.ledController.getBrightness();

    this.currentAnimationProcess =
      fork(path.join(__dirname, 'animator.js'), [JSON.stringify(this.config), animationScript, brightness.toString()], {});

    if (this.config.useSocketIo) {
      const ledStrip: LedStrip = this.ledController.getLedStrip();
      this.socketIoServer.send('animation-started', {ledStrip: ledStrip});
    }

    // tslint:disable-next-line: typedef no-any
    const eventCallback = (message: any): void => {
      if (message === 'animation-finished') {
        this.currentAnimationProcess.removeListener('message', eventCallback);

        this.currentAnimationProcess.kill();
        this.currentAnimationProcess = undefined;

        if (this.config.useSocketIo) {
          const ledStrip: LedStrip = this.ledController.getLedStrip();
          this.socketIoServer.send('animation-finished', {ledStrip: ledStrip});
        }
      }
    };

    this.currentAnimationProcess.on('message', eventCallback);

    // TODO:
    // if (this.config.useSocketIo) {
    //   this.currentAnimationProcess.on('led-strip-changed', (ledStrip: LedStrip): void => {
    //     this.socketIoServer.send('led-strip-changed', {ledStrip: ledStrip});
    //   });
    // }

    response.status(200).send('success!');
  }

  private async stopAnimation(request: express.Request, response: express.Response): Promise<void> {
    if (this.currentAnimationProcess) {
      this.currentAnimationProcess.kill();
      this.currentAnimationProcess = undefined;
    }

    if (this.config.useSocketIo) {
      const ledStrip: LedStrip = this.ledController.getLedStrip();
      this.socketIoServer.send('animation-stopped', {ledStrip: ledStrip});
    }

    response.status(200).send('success!');
  }

  private async waitForAnimationToFinish(request: express.Request, response: express.Response): Promise<void> {
    // tslint:disable-next-line: typedef no-any
    const eventCallback = (message: any): void => {
      this.currentAnimationProcess.removeListener('message', eventCallback);

      if (message === 'animation-finished') {
        response.status(200).send('success!');
      }
    };

    this.currentAnimationProcess.on('message', eventCallback);
  }
}
