export class Logger {
  private appName: string = 'WS2801-Pi-web-server';
  private moduleName: string;

  constructor(moduleName: string) {
      this.moduleName = moduleName;
  }

  public log(text: string): void {
      // tslint:disable-next-line: no-console
      console.log(`${this.appName} | ${this.moduleName} | ${text}`);
  }
}
