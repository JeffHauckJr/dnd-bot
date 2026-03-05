FROM node:20-bookworm

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        ffmpeg \
        ca-certificates \
        curl \
        gnupg \
        git \
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/*

# Install yt-dlp and the POT provider plugin
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    yt-dlp \
    bgutil-ytdlp-pot-provider

# Set up POT provider server
WORKDIR /pot-provider
RUN git clone --single-branch --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git . && \
    cd server && \
    npm install && \
    npx tsc

# Set working directory for the bot
WORKDIR /app

# Copy bot files
COPY . .

# Install Node.js dependencies
RUN npm install

# Environment variables
ENV NODE_ENV=production
ENV PyPath=python3

# Create startup script that runs POT server and bot
RUN echo '#!/bin/bash\nnode /pot-provider/server/build/main.js &\nsleep 2\nnode app.js' > /start.sh && \
    chmod +x /start.sh

# Start both services
CMD ["/start.sh"]
