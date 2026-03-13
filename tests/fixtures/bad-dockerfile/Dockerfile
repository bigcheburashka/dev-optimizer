# Bad Dockerfile Example
# This has many issues that dev-optimizer should detect

FROM ubuntu:latest

RUN apt-get update
RUN apt-get install -y nodejs npm
RUN apt-get install -y curl
RUN apt-get install -y git

WORKDIR /app

COPY . .
RUN npm install

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]