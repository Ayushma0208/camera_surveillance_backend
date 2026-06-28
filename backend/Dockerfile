FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma

RUN bun install --frozen-lockfile
RUN bunx prisma generate

COPY tsconfig.json ./
COPY src ./src

EXPOSE 4000

CMD ["bun", "run", "start"]
