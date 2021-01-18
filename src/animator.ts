import vm from 'vm';

import Ws2801Pi, {LedStrip} from 'ws2801-pi';

const amountOfLeds: number = parseInt(process.argv[2]);
const animationScript: string = process.argv[3];
const startBrightness: number | 'auto' = process.argv[4] === 'auto' ?  'auto' : parseInt(process.argv[4]);

async function runAnimation(): Promise<void> {
  const ledController: Ws2801Pi = new Ws2801Pi(amountOfLeds);
  ledController.setBrightness(startBrightness);

  // tslint:disable-next-line: no-any
  process.on('message', (message: any): void => {
    if (message.action === 'set-brightness') {
      ledController.setBrightness(message.brightness).show();
    } else if (message.action === 'get-led-strip') {
      process.send({action: 'get-led-strip-answer', ledStrip: ledController.getLedStrip()});
    }
  });

  const context: vm.Context = vm.createContext(Object.assign(
    {},
    global,
    {
      ledController: ledController,
      ledAmount: amountOfLeds,
      exports: exports,
      module: module,
      console: console,
    },
  ));

  ledController.onLedStripChanged((ledStrip: LedStrip): void => {
    process.send({action: 'led-strip-changed', ledStrip: ledStrip});
  });

  await vm.runInContext(animationScript, context);

  process.send('animation-finished');
}
runAnimation();
