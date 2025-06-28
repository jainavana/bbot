FROM node:20-slim

# Install Chromium and its dependencies
RUN apt-get update && apt-get install -y \
    git \
    chromium \
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
    ca-certificates \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV CHROME_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Avoid sandbox errors in container
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox"

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code (including session data)
COPY . .

# Expose port if needed
EXPOSE 3000

# Start app
CMD ["node", "main.js"]