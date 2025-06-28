FROM node:18-slim

# Install Chromium + deps
RUN apt-get update && apt-get install -y \
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
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set CHROME_PATH to the installed binary
ENV CHROME_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your code
COPY . .

# Use Chrome with Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Expose port if needed (optional)
EXPOSE 3000

# Start your app
CMD ["node", "main.js"]