FROM node:18-slim

# Install Python3, pip, ffmpeg
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install

ENV NODE_ENV=production
ENV PyPath=python3

CMD ["node", "index.js"]