#!/bin/sh
sed "s|BACKEND_URL_PLACEHOLDER|$BACKEND_URL|g" /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g "daemon off;"
