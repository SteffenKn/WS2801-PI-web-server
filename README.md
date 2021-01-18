# WS2801-webserver

This is a ready-to-use webserver for the [WS2801-Pi package](https://www.npmjs.com/package/ws2801-pi).

You may also want to have a look at [WS2801](https://github.com/SteffenKn/WS2801) which includes the [Webserver](https://www.npmjs.com/package/ws2801-webserver) (this package), the [Alexa handler](https://www.npmjs.com/package/ws2801-alexa) and the [LedController](https://www.npmjs.com/package/ws2801-pi).

## Wiring

The wiring of the Pi is described [here](https://github.com/SteffenKn/WS2801-PI#wiring).

## Usage

There are basically two ways of how to use WS2801-webserver:

### Using this repository

1. Clone this repository
2. Edit the config file as described here
3. Run the build script: `npm run build`
4. Run the start scripot: `npm start`

### Using the npm module

1. Create a new npm project folder
2. Install this module `npm i ws2801-webser`

```typescript
import {Config as WebserverConfig, Ws2801Webserver} from 'ws2801-webserver';

const config: WebserverConfig = {
  port: 45451,
  confirmationPort: 45452,
  amountOfLeds: 10,
  useAuth: true,
};

const webserver: Ws2801Webserver = new Ws2801Webserver(config);

webserver.start();
```

## Configuration

The config can be provided when initializing the Ws2801Webserver.
If no config was provided or if the repository is used the defaultConfig will be used which is stored [here](./src/config/config.ts).

The config may look like this:
```
{
  port: 45451,
  confirmationPort: 45452,
  amountOfLeds: 10,
  useAuth: true,
};
```

- `port` is used for the webserver that provides the most routes. This may be publicly available.
- `confirmationPort` is only needed if the auth mechanism is activated (`useAuth` is set to true). This webserver provides the confirmation routes for new registration. This should never be publicly available, at least until a proper confirmation website is available.
- `amountOfLeds` is used to define how many leds are connected to the Pi. This is only necessary if no other ledController is provided in the constructor.
- `useAuth` is used to define if the auth mechanism should be used or not.
## Functions

### constructor

#### Parameters:

- `config`
  - optional
  - Type: [Config](./types/config.ts)
  - The config for this module as described [here](#Configuration). If no value is set the [default config](./src/config/config.ts) will be used.

- `ledController`
  - optional
  - Type: [LedController](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L44)
  - The LED controller that controls the leds of the connected Led strip. If no value is provided WS2801-webserver will create it's own LedController with the LedAmount that is configured in the [default config](./src/config/config).
    - To prevent render problems there should be only one LedController instance.

### start

Starts the webserver.

### stop

Stops the webserver.

### getExpressServer

Returns the express server instance used by WS2801-webserver. This can be used to add more routes.

#### Returns

Return the express server instance.
- Type: [express](https://www.npmjs.com/package/express)

## Routes

The routes marked with [Auth] can only be used when the auth mechansim is activated.
If the auth mechanism is activated, any routes except `/login-required` and `/register` an apiKey must be provided as query parameter. Otherwise a 403 will be returned.

### GET: /login-required

Returns if the auth mechanism is activated or not.

- Route: /login-required
- Method: Get
- Returns:
  - 200
    - Type: {loginRequired: boolean}

### Post: /register [Auth]

Registers a new user and waits for confirmation.

- Route: /register
- Method: Post
- Body: {name: string, apiKey: string}
- Returns:
  - 200
    - Registration was successful
      - Type: {apiKey: string}
  - 400
    - Body was incorrect
      - Type: string
  - 403
    - Username already exists
      - Type: string
    - Registration was not confirmed
      - Type: string
    - Registration was not successful
      - Type: string
### Post: /login [Auth]

Checks if an apiKey work.

- Route: /login
- Method: Post
- Returns:
  - 200
    - Login was successful
      - Type: {apiKey: string}
  - 400
    - Body was incorrect
      - Type: string
  - 403
    - User in not registered
      - Type: string
    - User is not permitted to use the api
      - Type: string

### Get: /led-strip

Returns the current state of the led strip.

- Route: /led-strip
- Method: Get
- Returns:
  - 200
    - Type: {ledStrip: [LedStrip](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L6)}

### Post: /led-strip/fill

Fills the led strip with a single color.

- Route /led-strip/fill
- Method: Post
- Body:
  - color
    - Type: [LedColor](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L8-L12)
  - brightness
    - optional
    - Type: number
- Returns:
  - 200
    - The Led Strip was successfully changed.
      - Type: {ledStrip: [LedStrip](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L6)}
  - 400
    - Body was incorrect
      - Type: string

### Post: /led-strip/clear

Clears the led strip.

- Route: /led-strip/clear
- Method: Post
- Returns:
  - 200
    - Type: {ledStrip: [LedStrip](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L6)}

### Post: /led-strip/led/:ledIndex/set

- Route: /led-strip/led/:ledIndex/set
- Method: Post
- Route Parameter:
  - ledIndex: number
- Body:
  - color
    - Type: [LedColor](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L8-L12)
  - brightness (brightness is set for the whole LED strip)
    - optional
    - Type: number
- Returns:
  - 200
    - The Led was successfully changed.
      - Type: {ledStrip: [LedStrip](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L6)}
  - 400
    - Body was incorrect
      - Type: string

### Post: /led-strip/brightness/set

- Route: /led-strip/brightness/set
- Method: Post
- Body:
  - brightness (brightness is set for the whole LED strip)
    - Type: number
- Returns:
  - 200
    - The brightness successfully changed.
      - Type: string
  - 400
    - Body was incorrect
      - Type: string

### Get: /led-strip/brightness

- Route: /led-strip/brightness
- Method: Get
 - Returns: {brightness: number}

### Post: /led-strip/set

Sets all leds according to the provided colors.

- Route /led-strip/set
- Method: Post
- Body:
  - ledStrip
    - Type: [LedStrip](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L6)
  - brightness
    - optional
    - Type: number
- Returns:
  - 200
    - The Led Strip was successfully changed.
      - Type: {ledStrip: [LedStrip](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L6)}
  - 400
    - Body was incorrect
      - Type: string
    - Provided LedStrip was invalid
      - Type: string

### Post: /led-strip/animation/start

Executes the provided animation script. The animation script must be provided as a string.
The animation script can access the [LED controller](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L44) via `ledController` and the amount of Leds via `ledAmount`.

- Route /led-strip/set
- Method: Post
- Body:
  - animationScript
    - Type: string
- Returns:
  - 200
    - The animation was successfully started
      - Type: string
  - 400
    - Body was incorrect
      - Type: string

### Delete: /led-strip/animation/stop

Cancels the currently running animation.

- Route /led-strip/set
- Method: Delete
- Returns:
  - 200
    - The animation was successfully stopped
      - Type: string

### Get: /led-strip/animation/finished

Returns as soon as the currently running animation finished.

- Route /led-strip/animation/finished
- Method: Get
- Returns:
  - 200
    - The animation was successfully finished.
      - Type: string


## Socket.Io Events

### LedStrip changed

Gets triggered everytime the LedStrip gets changed.

- Event: 'led-strip__changed'
- Payload: [LedStrip](https://github.com/SteffenKn/WS2801-PI/blob/develop/src/index.ts#L6)

### Brightness changed

Gets triggered everytime the brightness gets changed.

- Event: 'brightness__changed'
- Payload: number

### Animation started

Gets triggered everytime an animation was started.

- Event: 'animation__started'

### Animation finished

Gets triggered everytime an animation was finished.

- Event: 'animation__finished'

### Animation storpped

Gets triggered everytime an animation was stopped.

- Event: 'animation__stopped'

## Authorization

The auth mechanism provides simple authorization. It can be activated or deactivated via the config.
In order to check if a WS2801-webserver instance uses authorization the [loginRequired route](#loginRequired) can be used.

The authorization works like so:

- New user asks for registration via the [register route](#register), providing a username and an apiKey
- If the username does not already exist, a confirmation link gets logged in the console.
- As soon as the confirmation link was clicked the user is registered.
- The user can than check if he is logged in by using the [login route](#login)
- The api key must than be provided as query parameter for any other api calls, otherwise a 403 error will be returend.
