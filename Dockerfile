FROM node:24-slim

# Install Chromium and required system libraries for Puppeteer/Chromium
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libatk1.0-0 \
    libcups2 \
    libasound2 \
    libpangocairo-1.0-0 \
    fonts-liberation \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only for smaller image
COPY package*.json ./
RUN npm ci --production

# Copy app source
COPY . .

# Ensure puppeteer/whatsapp-web.js finds the system Chrome binary
ENV EXECUTABLE_PATH=/usr/bin/chromium

# Start the app
CMD ["npm", "start"]
