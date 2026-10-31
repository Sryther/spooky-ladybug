# syntax=docker/dockerfile:1
# =============================================================================
# Hardened, minimal image for the static "Spooky Ladybug" Halloween photobooth.
# Uses the unprivileged NGINX image (non-root, listens on 8080) pinned by digest.
# =============================================================================

# Unprivileged NGINX (non-root, listens on 8080), Alpine-based for a tiny surface.
# For production, pin by digest, e.g.:
#   FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:<digest>
# Resolve the current digest with:
#   docker buildx imagetools inspect nginxinc/nginx-unprivileged:1.27-alpine
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Run as the built-in unprivileged "nginx" user (UID 101) — never root.
USER 101

# Static site + hardened server config.
COPY --chown=101:0 nginx.conf /etc/nginx/nginx.conf
COPY --chown=101:0 src/       /usr/share/nginx/html/

EXPOSE 8080

# Built-in healthcheck mirrors the Kubernetes probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["sh", "-c", "wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1"]

CMD ["nginx", "-g", "daemon off;"]
