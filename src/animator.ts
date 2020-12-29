
import vm from 'vm';

import Ws2801Pi from 'ws2801-pi';

import {Config} from './config/config';

const animationScript: string = process.argv[2];
const startBrightness: number | 'auto' = process.argv[3] !== 'auto' ? parseInt(process.argv[3]) : process.argv[3];

async function runAnimation(): Promise<void> {
  const ledController: Ws2801Pi = new Ws2801Pi(Config.amountOfLeds);
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
      ledAmount: Config.amountOfLeds,
      exports: exports,
      module: module,
      console: console,
    },
  ));

  await vm.runInContext(animationScript, context);

  process.send('animation-finished');
}
runAnimation();
