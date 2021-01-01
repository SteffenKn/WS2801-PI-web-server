import {Ws2801PiWebserverConfig} from '../types/index';

// tslint:disable-next-line: variable-name
export const Config: Ws2801PiWebserverConfig = {
  port: 45451,
  amountOfLeds: 141,
  useAuth: true,
  confirmationPort: 45452,
  useSocketIo: false,
};
