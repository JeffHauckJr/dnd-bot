FROM node:18-bullseye

# Avoid interactive prompts and broken mirrors
ENV DEBIAN_FRONTEND=noninteractive

# Update and install packages safely
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ffmpeg \
        ca-certificates \
        curl \
        gnupg \
        && pip3 install --no-cache-dir yt-dlp \
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy files into container
COPY . .

# Install Node.js dependencies
RUN npm install

# Environment variables (override via Railway dashboard if needed)
ENV NODE_ENV=production
ENV PyPath=python3

# Start the bot
CMD ["node", "app.js"]
