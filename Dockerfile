FROM node:18

WORKDIR /app

# Install required system libraries
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
    libdrm2 \            
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]