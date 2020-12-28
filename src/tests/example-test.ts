import chai from 'chai';

import Example from '../example';

const expect: Chai.ExpectStatic = chai.expect;

describe('Example', (): void => {
  it('should return "Hello Peter"', async(): Promise<void> => {
    const example: Example = new Example();

    expect(example.hello('Peter')).to.equal('Hello Peter');
  });
});
