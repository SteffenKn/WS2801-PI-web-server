import express from 'express';
import ip from 'ip';

import {Logger} from './logger';
import {Persister} from './persister';
import {Webserver} from './webserver';

import {Config} from './config/config';
import {User} from './types/index';

type ResolveFunctionForRegistrationConfirmation = {name: string, resolveFunction: Function};

export class AuthService {
  private persister: Persister;
  private webserver: Webserver;
  private confirmationWebserver: Webserver;
  private logger: Logger;

  private users: Array<User>;

  private resolveFunctionsForRegistrationConfirmation: Array<ResolveFunctionForRegistrationConfirmation> = [];

  constructor(webserver: Webserver) {
    this.webserver = webserver;

    this.logger = new Logger('Auth Service');
    this.persister = new Persister();
  }

  public start(): void {
    this.confirmationWebserver = new Webserver(Config.confirmationPort);

    this.loadUsers();

    this.addAuthMiddleware();
    this.addAuthRoutes();

    this.confirmationWebserver.start();
  }

  private registerUser(name: string, apiKey: string): User {
    const userExists: boolean = this.users.some((user: User): boolean => user.name === name);

    if (userExists) {
      throw new Error(`User with name '${name}' already exists.`);
    }

    const newUser: User = this.generateUser(name, apiKey);

    this.users.push(newUser);
    this.saveUsers();

    return newUser;
  }

  // private setUserIsAllowed(name: string, allowed: boolean): void {
  //   this.users.find((user: User): boolean => user.name === name).allowed = allowed;
  // }

  private getUserByName(name: string): User {
    return this.users.find((user: User): boolean => user.name === name);
  }

  private getUserByApiKey(apiKey: string): User {
    return this.users.find((user: User): boolean => user.apiKey === apiKey);
  }

  private generateUser(name: string, apiKey: string): User {
    const user: User = {
      name: name,
      allowed: true,
      apiKey: apiKey,
    };

    return user;
  }

  private loadUsers(): void {
    const usersAsString: string = this.persister.loadData('webserver-api-keys.json');

    if (!usersAsString) {
      this.users = [];
      this.saveUsers();
      return;
    }

    this.users = JSON.parse(usersAsString);
  }

  private saveUsers(): void {
    this.persister.saveData('webserver-api-keys.json', JSON.stringify(this.users, null, 2));
  }

  private addAuthMiddleware(): void {
    this.webserver.addMiddleware(this.authMiddleware.bind(this));
  }

  private addAuthRoutes(): void {
    this.webserver.addPostRoute('/register', this.register.bind(this));
    this.webserver.addPostRoute('/login', this.login.bind(this));

    this.confirmationWebserver.addGetRoute('/confirm-registration', this.confirmRegistration.bind(this));
  }

  private async waitForConfirmation(name: string): Promise<void> {
    const confirmationForUserExists: boolean = this.resolveFunctionsForRegistrationConfirmation
      .some((resolveFunction: ResolveFunctionForRegistrationConfirmation): boolean => {
        return resolveFunction.name === name;
      });

    if (confirmationForUserExists) {
      throw new Error(`The user "${name}" is already waiting for confirmation.`);
    }

    const resolvePromise: Promise<void> = new Promise((resolve: Function): void => {
      this.resolveFunctionsForRegistrationConfirmation.push({
        name: name,
        resolveFunction: resolve,
      });

      this.logger.log(`User '${name}' would like to register.
Click this link to confirm: http://${ip.address()}:${Config.confirmationPort}/confirm-registration?name=${name.replace(/ /g, '%20').replace(/ /g, '%C2%A0')}`);
    });

    return resolvePromise;
  }

  // Middleware functions

  private authMiddleware(request: express.Request, response: express.Response, next: Function): void {
    if (request.path === '/login-required'
    || request.path === '/register'
    || request.path === '/login') {
      next();

      return;
    }

    const apiKey: string = request.query.apiKey as string;

    if (!apiKey) {
      response.status(401).send('Please register first.');

      return;
    }

    const user: User = this.getUserByApiKey(apiKey);
    if (!user) {
      response.status(401).send('Please register first.');

      return;
    }

    if (!user.allowed) {
      response.status(403).send(`You are not allowed to do that.`);

      return;
    }

    next();
  }

  // Route functions

  private async register(request: express.Request, response: express.Response): Promise<void> {
    const name: string = request.body.name;
    const apiKey: string = request.body.apiKey;

    if (!name) {
      response.status(400).send(`Request body must contain a 'name'.`);

      return;
    }
    if (!apiKey) {
      response.status(400).send(`Request body must contain a 'apiKey'.`);

      return;
    }

    const userAlreadyExists: boolean = this.getUserByName(name) !== undefined;
    if (userAlreadyExists) {
      response.status(403).send(`User '${name}' already exists.`);

      return;
    }

    try {
      await this.waitForConfirmation(name);
    } catch (error) {
      response.status(403).send(error.message);
      return;
    }

    try {
      this.registerUser(name, apiKey);

      response.status(200).json({apiKey: apiKey});
    } catch (error) {
      response.status(403).send(error.message);
    }
  }

  private confirmRegistration(request: express.Request, response: express.Response): void {
    const nameInQuery: string = request.query.name as string;

    if (!nameInQuery) {
      response.status(400).send(`Request must contain name as query param.`);

      return;
    }

    const resolveFunctionIndex: number = this.resolveFunctionsForRegistrationConfirmation
      .findIndex((resolveFunctionWithName: ResolveFunctionForRegistrationConfirmation): boolean => {
        return resolveFunctionWithName.name === nameInQuery;
      });

    if (resolveFunctionIndex === -1) {
      response.status(400).send(`Could not confirm registration.`);

      return;
    }

    this.resolveFunctionsForRegistrationConfirmation[resolveFunctionIndex].resolveFunction();
    this.resolveFunctionsForRegistrationConfirmation.splice(resolveFunctionIndex);

    response.status(200).send(`User '${nameInQuery}' was successfully registered.`);
  }

  private async login(request: express.Request, response: express.Response): Promise<void> {
    const apiKey: string = request.query.apiKey as string;

    if (!apiKey) {
      response.status(400).send(`Request must contain 'apiKey' as query parameter.`);

      return;
    }

    try {
      const user: User = this.getUserByApiKey(apiKey);

      if (!user) {
        throw new Error('User is not registered. Try to register again.');
      }

      if (!user.allowed) {
        throw new Error('You are not allowed to login.');
      }

      response.status(200).json({loggedIn: true});
    } catch (error) {
      response.status(403).send(error.message);
    }
  }
}
