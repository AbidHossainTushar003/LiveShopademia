FROM postgres:16-alpine

COPY init/10-app-role.sh /docker-entrypoint-initdb.d/10-app-role.sh
RUN chmod 0755 /docker-entrypoint-initdb.d/10-app-role.sh
