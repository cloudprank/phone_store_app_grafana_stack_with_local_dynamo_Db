FROM node:18-alpine
WORKDIR /usr/src/app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Expose the web server port
EXPOSE 3000

# Start the application using the script that pre-loads OTEL
CMD ["npm", "start"]