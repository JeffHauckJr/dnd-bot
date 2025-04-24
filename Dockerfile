# Use a more complete image with better package support
FROM node:slim@sha256:dfb18d8011c0b3a112214a32e772d9c6752131ffee512e974e59367e46fcee52

# Install Python3, pip, and ffmpeg
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy files into container
COPY . .

# Install Node dependencies
RUN npm install

# Optional: Set your environment variable here (or in Railway dashboard)
ENV NODE_ENV=production
ENV PyPath=python3

# Run your bot
CMD ["node", "app.js"]
