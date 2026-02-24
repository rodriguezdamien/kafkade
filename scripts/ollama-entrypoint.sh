#!/bin/sh

# Start Ollama server in the background
ollama serve &

# Wait for it to be ready
sleep 5

# Pull the model (no-op if already present thanks to the volume)
ollama pull "$OLLAMA_MODEL"

# Bring the server back to the foreground
wait
