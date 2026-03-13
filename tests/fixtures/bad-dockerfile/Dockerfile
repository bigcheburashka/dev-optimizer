# Bad Dockerfile Example
# This has many issues that dev-optimizer should detect

FROM ubuntu:latest

RUN apt-get update
RUN apt-get install -y nodejs npm
RUN apt-get install -y curl
RUN apt-get install -y git
RUN apt-get install -y python3
RUN apt-get install -y build-essential
RUN apt-get install -y wget
RUN apt-get install -y vim
RUN apt-get install -y emacs

WORKDIR /app

# Inefficient copy - copies everything
COPY . .

RUN npm install

# Multiple RUN commands that should be combined
RUN npm run build
RUN npm run test
RUN npm run lint
RUN npm run format

# Expose ports
EXPOSE 3000
EXPOSE 8080
EXPOSE 443

# Running as root (bad practice)
CMD ["npm", "start"]