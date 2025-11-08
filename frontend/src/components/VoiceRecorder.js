import React, { useState, useRef, useEffect } from 'react';

function VoiceRecorder({
  onAudioRecorded,
  isRecording,
  setIsRecording,
  isProcessing,
  settings,
  onVolumeChange,
  autoStart = false
}) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [speechDetected, setSpeechDetected] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const volumeCheckIntervalRef = useRef(null);
  const minRecordingTimeRef = useRef(false);
  const speechStartTimeRef = useRef(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (autoStart && !isRecording && !isProcessing) {
      startRecording();
    }
  }, [autoStart]);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: settings.noiseReduction,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      streamRef.current = stream;

      // Setup Web Audio API for volume analysis
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const audioSource = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.3;
      audioSource.connect(analyserRef.current);

      // Setup MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        onAudioRecorded(audioBlob);
        cleanup();
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      minRecordingTimeRef.current = false;
      speechStartTimeRef.current = null;
      setSpeechDetected(false);

      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Minimum recording time before allowing auto-stop
      setTimeout(() => {
        minRecordingTimeRef.current = true;
      }, 1000);

      // Start volume monitoring and silence detection
      startVolumeMonitoring();

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  const calculateRMS = (dataArray) => {
    // Calculate Root Mean Square for better amplitude detection
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
  };

  const startVolumeMonitoring = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    // Speech detection parameters
    const SPEECH_THRESHOLD = 0.02; // RMS threshold for speech (adjustable)
    const BACKGROUND_THRESHOLD = 0.01; // Minimum to ignore complete silence

    volumeCheckIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      // Use time-domain data for better speech detection
      analyserRef.current.getByteTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) for amplitude
      const rms = calculateRMS(dataArray);

      // Calculate volume percentage (0-100)
      const volumePercent = Math.min(100, rms * 200); // Scale RMS to percentage

      // Update volume visualization
      if (onVolumeChange) {
        onVolumeChange(volumePercent);
      }

      // Detect if this is actual speech vs background noise
      const isSpeech = rms > SPEECH_THRESHOLD;
      const hasAudio = rms > BACKGROUND_THRESHOLD;

      if (isSpeech) {
        setSpeechDetected(true);
        if (!speechStartTimeRef.current) {
          speechStartTimeRef.current = Date.now();
          console.log('Speech detected, started listening...');
        }
      }

      // Silence detection - only after speech has been detected
      if (minRecordingTimeRef.current && speechStartTimeRef.current) {
        if (!isSpeech && hasAudio) {
          // Below speech threshold but still has some audio (silence after speech)
          if (!silenceTimeoutRef.current) {
            console.log('Silence detected after speech, starting countdown...');
            silenceTimeoutRef.current = setTimeout(() => {
              console.log('Silence duration reached, stopping recording');
              stopRecording();
            }, settings.silenceDuration * 1000);
          }
        } else if (isSpeech) {
          // Speech detected again - reset silence timer
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        }
      }

      // If no audio at all for too long before speech starts, might need to prompt user
      if (minRecordingTimeRef.current && !speechStartTimeRef.current) {
        const waitingTime = Date.now() - (Date.now() - recordingTime * 1000);
        if (waitingTime > 10000) { // 10 seconds of no speech
          console.log('No speech detected for 10 seconds');
        }
      }
    }, 100); // Check every 100ms
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setSpeechDetected(false);
      speechStartTimeRef.current = null;

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (volumeCheckIntervalRef.current) {
        clearInterval(volumeCheckIntervalRef.current);
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (onVolumeChange) {
        onVolumeChange(0);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder">
      {isRecording && (
        <div className="recording-indicator">
          🔴 Recording... {formatTime(recordingTime)}
          {speechDetected && <span className="speech-badge">✓ Speech Detected</span>}
          {!speechDetected && <span className="waiting-badge">⏳ Waiting for speech...</span>}
        </div>
      )}

      {isProcessing && (
        <div className="processing-indicator">
          ⏳ Processing...
        </div>
      )}

      <button
        className={`record-button ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
      >
        {isRecording ? (
          <>
            <span className="pulse">⏹️</span>
            <span>Stop Recording</span>
          </>
        ) : (
          <>
            <span className="mic-icon">🎤</span>
            <span>Start Recording</span>
          </>
        )}
      </button>
    </div>
  );
}

export default VoiceRecorder;
