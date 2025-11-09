class StateMachine {
  constructor() {
    this.state = 'idle';
    this.callbacks = [];

    // Define valid transitions
    this.transitions = {
      idle: ['start'],
      listening: ['silence_detected', 'stop'],
      transcribing: ['transcription_complete', 'stop'],
      thinking: ['llm_complete', 'stop'],
      speaking: ['audio_complete', 'interrupt', 'stop']
    };

    // Define next states
    this.nextStates = {
      start: 'listening',
      silence_detected: 'transcribing',
      transcription_complete: 'thinking',
      llm_complete: 'speaking',
      audio_complete: 'listening',
      interrupt: 'listening',
      stop: 'idle'
    };
  }

  getState() {
    return this.state;
  }

  transition(event) {
    const validTransitions = this.transitions[this.state];

    if (!validTransitions || !validTransitions.includes(event)) {
      throw new Error(`Invalid transition: ${event} from state ${this.state}`);
    }

    const oldState = this.state;
    this.state = this.nextStates[event];

    // Notify callbacks
    this.callbacks.forEach(cb => cb(oldState, this.state));
  }

  onStateChange(callback) {
    this.callbacks.push(callback);
  }

  reset() {
    this.state = 'idle';
  }
}

module.exports = StateMachine;
