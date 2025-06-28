FROM node:18-slim

# Install Chromium + deps + git
RUN apt-get update && apt-get install -y \
    git \
    chromium \
    chromium-driver \
    libglib2.0-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libdrm2 \
    fonts-liberation \
    xdg-utils \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./

RUN npm install --verbose

COPY . .

EXPOSE 3000

CMD ["node", "main.js"]