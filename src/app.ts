import {ChildProcess, fork} from 'child_process';
import express from 'express';
import path from 'path';

import Ws2801Pi, {LedColor, LedStrip} from 'ws2801-pi';

import {AuthService} from './auth-service';
import {Config} from './config/config';
import {validateLedStrip} from './led-strip-validation';
import {Webserver} from './webserver';

const webserver: Webserver = new Webserver(Config.port);
const authService: AuthService = new AuthService(webserver);

let currentAnimationProcess: ChildProcess;

const ledController: Ws2801Pi = new Ws2801Pi(Config.amountOfLeds);

async function run(): Promise<void> {
  webserver.start();

  if (Config.useAuth) {
    authService.start();
  }

  webserver.addGetRoute('/login-required', (_: express.Request, response: express.Response): void => {
    response.status(200).json({loginRequired: Config.useAuth});
  });

  webserver.addGetRoute('/led-strip', (_: express.Request, response: express.Response): void => {
    const ledStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip: ledStrip});
  });

  webserver.addPostRoute('/led-strip/fill', async(request: express.Request, response: express.Response): Promise<void> => {
    const color: LedColor = request.body.color;

    if (!color) {
      response.status(400).send(`Request body must contain a 'color', e.g. {red: 255, green: 0, blue: 0}.`);

      return;
    }

    await ledController.fillLeds(color).show();

    const ledStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip: ledStrip});
  });

  webserver.addPostRoute('/led-strip/clear', async(request: express.Request, response: express.Response): Promise<void> => {
    await ledController.clearLeds().show();

    const ledStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip: ledStrip});
  });

  webserver.addPostRoute('/led-strip/led/:ledIndex/set', async(request: express.Request, response: express.Response): Promise<void> => {
    const enteredLedIndex: string = request.params.ledIndex;
    const ledIndex: number = parseInt(enteredLedIndex);

    const color: LedColor = request.body.color;

    if (Number.isNaN(ledIndex) || ledIndex < 0 || ledIndex >= Config.amountOfLeds) {
      response.status(400).send(`URL must contain a led index between 0 and ${Config.amountOfLeds - 1} (Received ${enteredLedIndex}).`);

      return;
    }

    if (!color) {
      response.status(400).send(`Request body must contain a 'color', e.g. {red: 255, green: 0, blue: 0}.`);

      return;
    }

    await ledController.setLed(ledIndex, color).show();

    const ledStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip: ledStrip});
  });

  webserver.addPostRoute('/led-strip/brightness/set', async(request: express.Request, response: express.Response): Promise<void> => {
    const brightness: number | 'auto' = request.body.brightness;

    if (brightness == undefined || (typeof brightness !== 'number' && brightness !== 'auto') || brightness < 0 || brightness > 100) {
      response.status(400).send(`Request body must contain a 'brightness' (number between 0 and 100 or 'auto' for automatic brightness).`);

      return;
    }

    await ledController.setBrightness(brightness).show();

    if (currentAnimationProcess) {
      currentAnimationProcess.send({brightness: brightness});
    }

    const ledStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip: ledStrip});
  });

  webserver.addGetRoute('/led-strip/brightness', async(request: express.Request, response: express.Response): Promise<void> => {
    const brightness: number | 'auto' = ledController.getBrightness();

    response.status(200).json({brightness: brightness});
  });

  webserver.addPostRoute('/led-strip/set', async(request: express.Request, response: express.Response): Promise<void> => {
    const ledStrip: LedStrip = request.body.ledStrip;

    if (!ledStrip) {
      response.status(400).send(`Request body must contain a 'ledStrip' (an array of LedColors with the length of the led strip).`);

      return;
    }

    try {
      validateLedStrip(Config.amountOfLeds, ledStrip);
    } catch (error) {
      response.status(400).send(error.message);

      return;
    }

    for (let ledIndex: number = 0; ledIndex < ledStrip.length; ledIndex++) {
      ledController.setLed(ledIndex, ledStrip[ledIndex]);
    }

    await ledController.show();

    const renderedLedStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip: renderedLedStrip});
  });

  webserver.addPostRoute('/led-strip/animation/start', async(request: express.Request, response: express.Response): Promise<void> => {
    const animationScript: string = request.body.animationScript;

    if (animationScript == undefined) {
      response.status(400).send(`Request body must contain a 'animationScript'.`);

      return;
    }

    if (currentAnimationProcess) {
      currentAnimationProcess.kill();
      currentAnimationProcess = undefined;
    }

    const brightness: number | 'auto' = ledController.getBrightness();

    currentAnimationProcess = fork(path.join(__dirname, 'animator.js'), [animationScript, brightness.toString()], {});
    currentAnimationProcess.once('animation-finished', (): void => {
      currentAnimationProcess.kill();
      currentAnimationProcess = undefined;
    });

    response.status(200).send('success!');
  });

  webserver.addDeleteRoute('/led-strip/animation/stop', async(request: express.Request, response: express.Response): Promise<void> => {
    if (currentAnimationProcess) {
      currentAnimationProcess.kill();
      currentAnimationProcess = undefined;
    }

    response.status(200).send('success!');
  });

  webserver.addGetRoute('/led-strip/animation/finished', async(request: express.Request, response: express.Response): Promise<void> => {
    currentAnimationProcess.once('animation-finished', (): void => {
      response.status(200).send('success!');
    });
  });
}

run();
