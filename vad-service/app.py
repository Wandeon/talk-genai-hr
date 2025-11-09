#!/usr/bin/env python3
"""
Silero VAD Microservice
Advanced Voice Activity Detection using Silero-VAD
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torchaudio
import numpy as np
import io
import os
import tempfile

app = Flask(__name__)
CORS(app)

# Load Silero VAD model
print("Loading Silero VAD model...")
model, utils = torch.hub.load(
    repo_or_dir='snakers4/silero-vad',
    model='silero_vad',
    force_reload=False,
    onnx=False
)

(get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks) = utils

# VAD parameters
SAMPLING_RATE = 16000
THRESHOLD = 0.5  # Speech probability threshold

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'silero-vad',
        'model_loaded': model is not None
    })

@app.route('/api/detect', methods=['POST'])
def detect_speech():
    """
    Detect speech in audio file

    Request:
        - file: audio file (multipart/form-data)

    Response:
        - has_speech: boolean
        - timestamps: list of speech segments [{start, end}]
        - confidence: average speech probability
    """
    try:
        # Get audio file from request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        audio_file = request.files['file']

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            audio_file.save(tmp_file.name)
            tmp_path = tmp_file.name

        try:
            # Read audio
            wav = read_audio(tmp_path, sampling_rate=SAMPLING_RATE)

            # Get speech timestamps
            speech_timestamps = get_speech_timestamps(
                wav,
                model,
                threshold=THRESHOLD,
                sampling_rate=SAMPLING_RATE,
                min_speech_duration_ms=250,
                min_silence_duration_ms=100,
                window_size_samples=512,
                speech_pad_ms=30
            )

            # Calculate average confidence
            has_speech = len(speech_timestamps) > 0

            # Get speech probabilities for confidence score
            speech_probs = []
            if has_speech:
                for segment in speech_timestamps:
                    segment_audio = wav[segment['start']:segment['end']]
                    speech_prob = model(segment_audio, SAMPLING_RATE).item()
                    speech_probs.append(speech_prob)

            avg_confidence = np.mean(speech_probs) if speech_probs else 0.0

            # Convert timestamps to seconds
            timestamps_seconds = [
                {
                    'start': ts['start'] / SAMPLING_RATE,
                    'end': ts['end'] / SAMPLING_RATE
                }
                for ts in speech_timestamps
            ]

            return jsonify({
                'has_speech': has_speech,
                'timestamps': timestamps_seconds,
                'confidence': float(avg_confidence),
                'num_segments': len(speech_timestamps)
            })

        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        print(f"Error in detect_speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/detect_stream', methods=['POST'])
def detect_stream():
    """
    Detect speech in audio chunk (streaming mode)

    Request:
        - audio: base64 encoded audio data or binary
        - reset: boolean (reset VAD state)

    Response:
        - is_speech: boolean
        - probability: float (0-1)
    """
    try:
        # Get audio data
        if 'file' in request.files:
            audio_file = request.files['file']
            audio_bytes = audio_file.read()
        else:
            audio_bytes = request.data

        # Convert to tensor
        audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        wav = torch.from_numpy(audio_array)

        # Get speech probability
        speech_prob = model(wav, SAMPLING_RATE).item()

        is_speech = speech_prob > THRESHOLD

        return jsonify({
            'is_speech': is_speech,
            'probability': float(speech_prob),
            'threshold': THRESHOLD
        })

    except Exception as e:
        print(f"Error in detect_stream: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/vad_iterator', methods=['POST'])
def vad_iterator_endpoint():
    """
    Use VAD iterator for real-time processing
    Maintains state across chunks
    """
    # This would require session management, which is complex for stateless HTTP
    # For now, return not implemented
    return jsonify({
        'error': 'VAD iterator requires WebSocket connection',
        'message': 'Use /api/detect_stream for stateless chunk processing'
    }), 501

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎙️  Silero VAD Service Starting")
    print("="*60)
    print(f"Model loaded: {model is not None}")
    print(f"Sampling rate: {SAMPLING_RATE} Hz")
    print(f"Threshold: {THRESHOLD}")
    print("="*60 + "\n")

    app.run(
        host='0.0.0.0',
        port=5052,
        debug=False
    )
