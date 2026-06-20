FROM node:20-alpine

WORKDIR /usr/src/app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /usr/src/app/backend

EXPOSE 5000
CMD ["node", "server.js"]
