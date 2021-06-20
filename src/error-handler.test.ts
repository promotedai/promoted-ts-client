import { logOnError } from './error-handler';

describe('log error handler', () => {
  it('console.error simple text"', () => {
    console.error = jest.fn();
    const err = new Error('hello');
    logOnError(err);
    expect(console.error).toHaveBeenCalledWith(err);
  });
});
