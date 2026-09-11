FROM nginx:1.27-alpine

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost:80/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
