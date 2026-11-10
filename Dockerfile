FROM node:24 as front-build
COPY client/ /client
WORKDIR /client
RUN npm install
RUN npm run build

FROM golang:1.27.3-alpine3.24 as back-build
COPY server/ /server
WORKDIR /server
RUN go build -o server ./cmd

FROM alpine:latest as run
WORKDIR /
COPY --from=front-build /client/build /static
COPY --from=back-build /server/server /
ENTRYPOINT ["/server"]