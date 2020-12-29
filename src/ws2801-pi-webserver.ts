import {ChildProcess, fork} from 'child_process';
import express from 'express';
import path from 'path';

import LedController, {LedColor, LedStrip} from 'ws2801-pi';

import {AuthService} from './auth-service';
import {Config as DefaultConfig} from './config/config';
import {validateLedStrip} from './led-strip-validation';
import {Webserver} from './webserver';

import {Ws2801PiWebserverConfig} from './types';

export class Ws2801PiWebserver {
  private ledController: LedController;
  private webserver: Webserver;
  private authService: AuthService;

  private config: Ws2801PiWebserverConfig;

  private currentAnimationProcess: ChildProcess;

  constructor(config?: Ws2801PiWebserverConfig, ledController?: LedController) {
    this.config = config ? config : DefaultConfig;

    this.ledController = ledController ? ledController : new LedController(this.config.amountOfLeds);
    this.webserver = new Webserver(this.config.port);
    this.authService = new AuthService(this.webserver);
  }

  public start(): void {
    this.addRoutes();

    this.webserver.start();

    if (this.config.useAuth) {
     this. authService.start();
    }
  }

  private addRoutes(): void {
    this.webserver.addGetRoute('/login-required', (_: express.Request, response: express.Response): void => {
      response.status(200).json({loginRequired: this.config.useAuth});
    });

    this.webserver.addGetRoute('/led-strip', (_: express.Request, response: express.Response): void => {
      const ledStrip: LedStrip = this.ledController.getLedStrip();

      response.status(200).json({ledStrip: ledStrip});
    });

    this.webserver.addPostRoute('/led-strip/fill', async(request: express.Request, response: express.Response): Promise<void> => {
      const color: LedColor = request.body.color;

      if (!color) {
        response.status(400).send(`Request body must contain a 'color', e.g. {red: 255, green: 0, blue: 0}.`);

        return;
      }

      await this.ledController.fillLeds(color).show();

      const ledStrip: LedStrip = this.ledController.getLedStrip();

      response.status(200).json({ledStrip: ledStrip});
    });

    this.webserver.addPostRoute('/led-strip/clear', async(request: express.Request, response: express.Response): Promise<void> => {
      await this.ledController.clearLeds().show();

      const ledStrip: LedStrip = this.ledController.getLedStrip();

      response.status(200).json({ledStrip: ledStrip});
    });

    this.webserver.addPostRoute('/led-strip/led/:ledIndex/set', async(request: express.Request, response: express.Response): Promise<void> => {
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

      response.status(200).json({ledStrip: ledStrip});
    });

    this.webserver.addPostRoute('/led-strip/brightness/set', async(request: express.Request, response: express.Response): Promise<void> => {
      const brightness: number | 'auto' = request.body.brightness;

      if (brightness == undefined || (typeof brightness !== 'number' && brightness !== 'auto') || brightness < 0 || brightness > 100) {
        response.status(400).send(`Request body must contain a 'brightness' (number between 0 and 100 or 'auto' for automatic brightness).`);

        return;
      }

      await this.ledController.setBrightness(brightness).show();

      if (this.currentAnimationProcess) {
        this.currentAnimationProcess.send({brightness: brightness});
      }

      const ledStrip: LedStrip = this.ledController.getLedStrip();

      response.status(200).json({ledStrip: ledStrip});
    });

    this.webserver.addGetRoute('/led-strip/brightness', async(request: express.Request, response: express.Response): Promise<void> => {
      const brightness: number | 'auto' = this.ledController.getBrightness();

      response.status(200).json({brightness: brightness});
    });

    this.webserver.addPostRoute('/led-strip/set', async(request: express.Request, response: express.Response): Promise<void> => {
      const ledStrip: LedStrip = request.body.ledStrip;

      if (!ledStrip) {
        response.status(400).send(`Request body must contain a 'ledStrip' (an array of LedColors with the length of the led strip).`);

        return;
      }

      try {
        validateLedStrip(this.config.amountOfLeds, ledStrip);
      } catch (error) {
        response.status(400).send(error.message);

        return;
      }

      for (let ledIndex: number = 0; ledIndex < ledStrip.length; ledIndex++) {
        this.ledController.setLed(ledIndex, ledStrip[ledIndex]);
      }

      await this.ledController.show();

      const renderedLedStrip: LedStrip = this.ledController.getLedStrip();

      response.status(200).json({ledStrip: renderedLedStrip});
    });

    this.webserver.addPostRoute('/led-strip/animation/start', async(request: express.Request, response: express.Response): Promise<void> => {
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

      // tslint:disable-next-line: typedef no-any
      const eventCallback = (message: any): void => {
        this.currentAnimationProcess.removeListener('message', eventCallback);

        if (message === 'animation-finished') {
          this.currentAnimationProcess.kill();
          this.currentAnimationProcess = undefined;
        }
      };

      this.currentAnimationProcess.on('message', eventCallback);

      response.status(200).send('success!');
    });

    this.webserver.addDeleteRoute('/led-strip/animation/stop', async(request: express.Request, response: express.Response): Promise<void> => {
      if (this.currentAnimationProcess) {
        this.currentAnimationProcess.kill();
        this.currentAnimationProcess = undefined;
      }

      response.status(200).send('success!');
    });

    this.webserver.addGetRoute('/led-strip/animation/finished', async(request: express.Request, response: express.Response): Promise<void> => {
      // tslint:disable-next-line: typedef no-any
      const eventCallback = (message: any): void => {
        this.currentAnimationProcess.removeListener('message', eventCallback);

        if (message === 'animation-finished') {
          response.status(200).send('success!');
        }
      };

      this.currentAnimationProcess.on('message', eventCallback);
    });
  }
}
