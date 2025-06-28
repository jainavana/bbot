FROM node:20-slim

# Install minimal deps for Puppeteer
# Add git here
RUN apt-get update && apt-get install -y \
    git \ 
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

# Create app directory
WORKDIR /app

# Install dependencies (this will install Puppeteer and download Chromium)
COPY package*.json ./
RUN npm install

# Copy rest of the code
COPY . .

# Expose if needed
EXPOSE 3000

# Start app
CMD ["node", "main.js"]