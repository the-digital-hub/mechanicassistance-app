import { errorReportText, errorSummary } from '../globalErrorHandler';

describe('error details for testers', () => {
  it('summarises a render error with the component tree that names the screen', () => {
    const err = Object.assign(new Error('Boom'), { componentStack: '\n    at ScheduledRequest\n    at Screen' });
    const text = errorSummary(err);
    expect(text).toContain('Boom');
    expect(text).toContain('at ScheduledRequest');
  });

  it('falls back to the JS stack and accepts a non-Error value', () => {
    expect(errorSummary(new Error('Plain'))).toContain('Plain');
    expect(errorSummary('just a string')).toContain('just a string');
  });

  it('builds the full report with a time, the message, the components and the stack', () => {
    const err = Object.assign(new Error('Boom'), { componentStack: 'at ScheduledRequest' });
    const text = errorReportText(err);
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(text).toContain('Components:\nat ScheduledRequest');
    expect(text).toContain('Boom');
  });
});
