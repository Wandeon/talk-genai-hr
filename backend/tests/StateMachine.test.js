const StateMachine = require('../lib/StateMachine');

describe('StateMachine', () => {
  let sm;

  beforeEach(() => {
    sm = new StateMachine();
  });

  test('should start in idle state', () => {
    expect(sm.getState()).toBe('idle');
  });

  test('should transition idle → listening on start', () => {
    sm.transition('start');
    expect(sm.getState()).toBe('listening');
  });

  test('should transition listening → transcribing on silence', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    expect(sm.getState()).toBe('transcribing');
  });

  test('should transition transcribing → thinking on transcription_complete', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    expect(sm.getState()).toBe('thinking');
  });

  test('should transition thinking → speaking on llm_complete', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    sm.transition('llm_complete');
    expect(sm.getState()).toBe('speaking');
  });

  test('should transition speaking → listening on audio_complete', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    sm.transition('llm_complete');
    sm.transition('audio_complete');
    expect(sm.getState()).toBe('listening');
  });

  test('should transition speaking → listening on interrupt', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    sm.transition('llm_complete');
    sm.transition('interrupt');
    expect(sm.getState()).toBe('listening');
  });

  test('should transition any state → idle on stop', () => {
    sm.transition('start');
    sm.transition('stop');
    expect(sm.getState()).toBe('idle');
  });

  test('should call callback on state change', () => {
    const callback = jest.fn();
    sm.onStateChange(callback);
    sm.transition('start');
    expect(callback).toHaveBeenCalledWith('idle', 'listening');
  });

  test('should throw error on invalid transition', () => {
    expect(() => sm.transition('invalid')).toThrow();
  });

  test('should transition idle → thinking on text_message', () => {
    sm.transition('text_message');
    expect(sm.getState()).toBe('thinking');
  });

  test('should transition listening → thinking on text_message', () => {
    sm.transition('start');
    sm.transition('text_message');
    expect(sm.getState()).toBe('thinking');
  });
});
