#!/usr/bin/env python3
"""
Streaming TTS Service with Parler-TTS
High-quality, low-latency text-to-speech with style control
"""

from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS
import torch
import torchaudio
import numpy as np
import io
import os
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Audio output directory
AUDIO_DIR = '/tmp/tts_audio'
os.makedirs(AUDIO_DIR, exist_ok=True)

# Model loading flag
MODEL_LOADED = False
model = None
tokenizer = None
SAMPLING_RATE = 24000

def load_model():
    """Load Parler-TTS model (or fallback to simple TTS)"""
    global model, tokenizer, MODEL_LOADED

    try:
        print("Attempting to load Parler-TTS model...")
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        model_name = "parler-tts/parler-tts-mini-v1"
        model = ParlerTTSForConditionalGeneration.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)

        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)

        MODEL_LOADED = True
        print(f"✅ Parler-TTS model loaded successfully on {device}")

    except Exception as e:
        print(f"⚠️  Could not load Parler-TTS: {e}")
        print("⚠️  Falling back to simple TTS placeholder")
        MODEL_LOADED = False

load_model()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'streaming-tts',
        'model_loaded': MODEL_LOADED,
        'sampling_rate': SAMPLING_RATE
    })

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    """
    Generate speech from text

    Request:
        - text: str (text to synthesize)
        - language: str (optional, default 'en')
        - style: str (optional, voice style description)

    Response:
        - audio_file: str (URL to audio file)
        - duration: int (duration in milliseconds)
    """
    try:
        data = request.get_json()
        text = data.get('text', '')
        language = data.get('language', 'en')
        style = data.get('style', 'A clear, friendly voice speaks naturally.')

        if not text:
            return jsonify({'error': 'No text provided'}), 400

        # Generate unique filename
        audio_id = str(uuid.uuid4())
        audio_filename = f"{audio_id}.wav"
        audio_path = os.path.join(AUDIO_DIR, audio_filename)

        if MODEL_LOADED:
            # Use Parler-TTS
            device = "cuda" if torch.cuda.is_available() else "cpu"

            # Tokenize style description
            input_ids = tokenizer(style, return_tensors="pt").input_ids.to(device)

            # Tokenize text
            prompt_input_ids = tokenizer(text, return_tensors="pt").input_ids.to(device)

            # Generate audio
            with torch.no_grad():
                generation = model.generate(
                    input_ids=input_ids,
                    prompt_input_ids=prompt_input_ids,
                    attention_mask=torch.ones_like(input_ids)
                )

            # Convert to audio
            audio_arr = generation.cpu().numpy().squeeze()

            # Save audio file
            torchaudio.save(
                audio_path,
                torch.from_numpy(audio_arr).unsqueeze(0),
                SAMPLING_RATE
            )

        else:
            # Fallback: Create a simple tone (for testing)
            duration = len(text.split()) * 0.5  # Rough estimate
            samples = int(duration * SAMPLING_RATE)

            # Generate simple sine wave (placeholder)
            frequency = 440  # A4 note
            t = np.linspace(0, duration, samples, False)
            audio_arr = np.sin(frequency * 2 * np.pi * t) * 0.3

            # Save audio file
            torchaudio.save(
                audio_path,
                torch.from_numpy(audio_arr).unsqueeze(0).float(),
                SAMPLING_RATE
            )

        # Calculate duration
        duration_ms = int((len(audio_arr) / SAMPLING_RATE) * 1000)

        # Return audio file URL
        audio_url = f"/audio/{audio_filename}"

        return jsonify({
            'audio_file': audio_url,
            'duration': duration_ms,
            'sampling_rate': SAMPLING_RATE,
            'model_used': 'parler-tts' if MODEL_LOADED else 'fallback'
        })

    except Exception as e:
        print(f"Error in text_to_speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tts_stream', methods=['POST'])
def text_to_speech_stream():
    """
    Stream audio generation in chunks

    Request:
        - text: str
        - style: str (optional)

    Response:
        - Streaming audio data
    """
    try:
        data = request.get_json()
        text = data.get('text', '')
        style = data.get('style', 'A clear, friendly voice speaks naturally.')

        if not text:
            return jsonify({'error': 'No text provided'}), 400

        def generate_audio_stream():
            """Generator function for streaming audio"""

            if MODEL_LOADED:
                device = "cuda" if torch.cuda.is_available() else "cpu"

                # Tokenize
                input_ids = tokenizer(style, return_tensors="pt").input_ids.to(device)
                prompt_input_ids = tokenizer(text, return_tensors="pt").input_ids.to(device)

                # Generate with streaming (if model supports it)
                try:
                    # Note: Parler-TTS may not support true streaming yet
                    # This is a placeholder for when it does
                    with torch.no_grad():
                        generation = model.generate(
                            input_ids=input_ids,
                            prompt_input_ids=prompt_input_ids,
                            attention_mask=torch.ones_like(input_ids)
                        )

                    audio_arr = generation.cpu().numpy().squeeze()

                    # Chunk the audio for streaming
                    chunk_size = 4096
                    for i in range(0, len(audio_arr), chunk_size):
                        chunk = audio_arr[i:i+chunk_size]
                        # Convert to bytes
                        chunk_bytes = (chunk * 32767).astype(np.int16).tobytes()
                        yield chunk_bytes

                except Exception as e:
                    print(f"Streaming error: {e}")
                    yield b''

            else:
                # Fallback streaming
                duration = len(text.split()) * 0.5
                samples = int(duration * SAMPLING_RATE)
                frequency = 440
                t = np.linspace(0, duration, samples, False)
                audio_arr = np.sin(frequency * 2 * np.pi * t) * 0.3

                chunk_size = 4096
                for i in range(0, len(audio_arr), chunk_size):
                    chunk = audio_arr[i:i+chunk_size]
                    chunk_bytes = (chunk * 32767).astype(np.int16).tobytes()
                    yield chunk_bytes

        return Response(
            generate_audio_stream(),
            mimetype='audio/wav',
            headers={
                'Content-Disposition': 'attachment; filename=stream.wav',
                'X-Sample-Rate': str(SAMPLING_RATE)
            }
        )

    except Exception as e:
        print(f"Error in text_to_speech_stream: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    """Serve generated audio files"""
    try:
        audio_path = os.path.join(AUDIO_DIR, filename)
        if os.path.exists(audio_path):
            return send_file(audio_path, mimetype='audio/wav')
        else:
            return jsonify({'error': 'Audio file not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/voices', methods=['GET'])
def list_voices():
    """List available voice styles"""
    voices = [
        {
            'id': 'default',
            'name': 'Default',
            'description': 'A clear, friendly voice speaks naturally.'
        },
        {
            'id': 'professional',
            'name': 'Professional',
            'description': 'A professional, clear voice speaks quickly and efficiently.'
        },
        {
            'id': 'friendly',
            'name': 'Friendly',
            'description': 'A warm, friendly voice speaks enthusiastically.'
        },
        {
            'id': 'calm',
            'name': 'Calm',
            'description': 'A calm, soothing voice speaks slowly and peacefully.'
        },
        {
            'id': 'excited',
            'name': 'Excited',
            'description': 'An excited, energetic voice speaks quickly with enthusiasm.'
        }
    ]

    return jsonify({'voices': voices})

# Clean up old audio files periodically
def cleanup_old_files():
    """Remove audio files older than 1 hour"""
    try:
        current_time = datetime.now().timestamp()
        for filename in os.listdir(AUDIO_DIR):
            filepath = os.path.join(AUDIO_DIR, filename)
            if os.path.isfile(filepath):
                file_age = current_time - os.path.getmtime(filepath)
                if file_age > 3600:  # 1 hour
                    os.remove(filepath)
                    print(f"Cleaned up old file: {filename}")
    except Exception as e:
        print(f"Cleanup error: {e}")

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🔊 Streaming TTS Service Starting")
    print("="*60)
    print(f"Model loaded: {MODEL_LOADED}")
    print(f"Sampling rate: {SAMPLING_RATE} Hz")
    print(f"Audio directory: {AUDIO_DIR}")
    print("="*60 + "\n")

    # Schedule cleanup
    from threading import Timer
    def schedule_cleanup():
        cleanup_old_files()
        Timer(3600, schedule_cleanup).start()  # Run every hour

    schedule_cleanup()

    app.run(
        host='0.0.0.0',
        port=5053,
        debug=False,
        threaded=True
    )
