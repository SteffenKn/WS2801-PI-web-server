import fs from 'fs';
import path from 'path';

const PERSISTENCE_FOLDER: string = path.join(process.cwd(), '.storage');

export class Persister {
  constructor() {
    if (!fs.existsSync(PERSISTENCE_FOLDER)) {
      fs.mkdirSync(PERSISTENCE_FOLDER);
    }
  }

  public loadData(key: string): string {
    const pathToFile: string = path.join(PERSISTENCE_FOLDER, key);

    if (!fs.existsSync(pathToFile)) {
      return undefined;
    }

    return fs.readFileSync(path.join(PERSISTENCE_FOLDER, key), {encoding: 'utf-8'});
  }

  public saveData(key: string, value: string): void {
    const pathToFile: string = path.join(PERSISTENCE_FOLDER, key);

    fs.writeFileSync(pathToFile, value);
  }
}
