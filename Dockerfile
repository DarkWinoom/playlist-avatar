ARG NODE_IMAGE=node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY docs/licenses ./docs/licenses
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm check && pnpm notices

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 STATIC_DIR=/app/web NODE_OPTIONS=--max-old-space-size=128
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/server/dist/index.mjs ./server/index.mjs
COPY --from=build --chown=node:node /workspace/apps/web/dist ./web
COPY --from=build --chown=node:node /workspace/docs/THIRD_PARTY_LICENSES.txt ./THIRD_PARTY_LICENSES.txt
COPY THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "const r=require('node:http').get('http://127.0.0.1:8080/healthz',s=>{s.resume();s.on('end',()=>process.exit(s.statusCode===200?0:1));});r.on('error',()=>process.exit(1));r.setTimeout(3000,()=>r.destroy());"
CMD ["node", "/app/server/index.mjs"]
