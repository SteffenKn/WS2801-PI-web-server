export default class Example {
  public hello(name: string): string {
    const result: string = `Hello ${name}`;

    // tslint:disable-next-line:no-console
    console.log(result);

    return result;
  }
}
