# Stage 1: Build dependencies
FROM node:20-alpine AS deps
ARG NETWORK
WORKDIR /app
COPY . .
RUN yarn install
COPY ./packages/snap/.env-${NETWORK} ./packages/snap/.env

# Expose the ports the app runs on
EXPOSE 8000 8080

# Command to run the application
CMD ["yarn", "start"]
