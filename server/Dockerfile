# The anti-library cover store. Railway builds this with the service's root directory set to server/.
# No dependencies: plain Node, allowed to read only its own code and to read and write only the /data volume.
# It runs as root because Railway mounts volumes owned by root (a non-root user couldn't write there);
# Node's permission model is what keeps it to /data.
FROM node:24-alpine
ENV NODE_ENV=production STORE_DIR=/data PORT=8080
WORKDIR /app
COPY server.mjs ./
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
EXPOSE 8080
CMD ["node", "--permission", "--allow-fs-read=/app", "--allow-fs-read=/data", "--allow-fs-write=/data", "server.mjs"]
