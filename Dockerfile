# Use an official Node runtime as the base image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json, yarn.lock, and other configuration files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the dapp and snap
RUN yarn build:dapp
RUN yarn build:snap

# Expose the port the app runs on
EXPOSE 8000
EXPOSE 8080

# Command to run the application
CMD ["yarn", "start"]
