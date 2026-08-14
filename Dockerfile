# syntax=docker/dockerfile:1.7

FROM nginx:1.27-alpine

ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="RTCW WASM" \
	  org.opencontainers.image.description="Assetless RTCW SP and MP WebAssembly clients" \
      org.opencontainers.image.source="https://github.com/theodorecharles/rtcw-wasm" \
      org.opencontainers.image.revision="$VCS_REF"

COPY web/sp /usr/share/nginx/html
COPY SP/build/release-linux-x86_64/iowolfsp.x86_64 /opt/rtcw/bin/iowolfsp.x86_64
COPY SP/build/release-linux-x86_64/main/vm /opt/rtcw/sp-vm
COPY MP/build/release-linux-x86_64/iowolfded.x86_64 /opt/rtcw/bin/iowolfded.x86_64
COPY MP/build/release-linux-x86_64/iowolfmp.x86_64 /opt/rtcw/bin/iowolfmp.x86_64
COPY MP/build/release-linux-x86_64/main/vm /opt/rtcw/mp-vm
COPY SP/COPYING.txt /opt/rtcw/SP-COPYING.txt
COPY MP/COPYING.txt /opt/rtcw/MP-COPYING.txt
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /data/Main /data/custom_maps /opt/rtcw/bin \
    && printf '%s\n' \
        'Corresponding source for this image:' \
        "https://github.com/theodorecharles/rtcw-wasm/tree/${VCS_REF}" \
        'The image contains engine/runtime code only; supply proprietary RTCW data through /data.' \
        > /opt/rtcw/SOURCE-OFFER.txt \
    && chmod 0755 /opt/rtcw/bin/*

ENV HTTP_PORT=8088 \
    GAME_SLOTS=8 \
    KEEP_ALIVE=false \
    IDLE_TIMEOUT=15m \
    GAME_MODE=vanilla

VOLUME ["/data"]
EXPOSE 8088/tcp 27960/udp
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8088/health >/dev/null
