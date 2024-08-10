# Stage 1: Build dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY . .
RUN yarn install

# Expose the ports the app runs on
EXPOSE 8000 8080

# Command to run the application
CMD ["yarn", "start"]
