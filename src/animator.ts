import {Ws2801PiWebserverConfig} from './types/ws2801-pi-webserver-config';

import vm from 'vm';

import Ws2801Pi from 'ws2801-pi';

const config: Ws2801PiWebserverConfig = JSON.parse(process.argv[2]);
const animationScript: string = process.argv[3];
const startBrightness: number | 'auto' = process.argv[4] === 'auto' ?  'auto' : parseInt(process.argv[4]);

async function runAnimation(): Promise<void> {
  const ledController: Ws2801Pi = new Ws2801Pi(config.amountOfLeds);
  ledController.setBrightness(startBrightness);

  // tslint:disable-next-line: no-any
  process.on('message', (message: any): void => {
    if (message.brightness) {
      ledController.setBrightness(message.brightness).show();
    }
  });

  const context: vm.Context = vm.createContext(Object.assign(
    {},
    global,
    {
      ledController: ledController,
      ledAmount: config.amountOfLeds,
      exports: exports,
      module: module,
      console: console,
    },
  ));

  await vm.runInContext(animationScript, context);

  process.send('animation-finished');
}
runAnimation();
