import express from 'express';

import Ws2801Pi, {LedColor, LedStrip} from 'ws2801-pi';

import {AuthService} from './auth-service';
import {Config} from './config/config';
import {validateLedStrip} from './led-strip-validation';
import {Webserver} from './webserver';

const webserver: Webserver = new Webserver(Config.port);
const authService: AuthService = new AuthService(webserver);

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

    response.status(200).json({ledStrip});
  });

  webserver.addPostRoute('/led-strip/fill', async(request: express.Request, response: express.Response): Promise<void> => {
    const color: LedColor = request.body.color;

    if (!color) {
      response.status(400).send(`Request body must contain a 'color', e.g. {red: 255, green: 0, blue: 0}.`);

      return;
    }

    await ledController.fillLeds(color).show();

    const ledStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip});
  });

  webserver.addPostRoute('/led-strip/clear', async(request: express.Request, response: express.Response): Promise<void> => {
    await ledController.clearLeds().show();

    const ledStrip: LedStrip = ledController.getLedStrip();

    response.status(200).json({ledStrip});
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

    response.status(200).json({ledStrip});
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

    response.status(200).json({renderedLedStrip});
  });
}

run();
