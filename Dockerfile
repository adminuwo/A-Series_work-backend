FROM node:20-alpine

# Install system dependencies if needed (e.g. for image processing)
# RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the application
CMD ["node", "server.js"]
