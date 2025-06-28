# Use Node base image with bash and apt
FROM node:18

# Set working directory
WORKDIR /app

# Install system dependencies needed for Chromium
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libgconf-2-4 \
    libfontconfig1 \
    libxss1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libxfixes3 \
    libx11-xcb1 \
    libxtst6 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package files and install deps
COPY package*.json ./
RUN npm install

# Copy rest of the source code
COPY . .

# Expose default port (optional, in case future endpoints/log UI added)
EXPOSE 3000

# Run the app
CMD ["npm", "start"]