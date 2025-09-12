FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código
COPY . .

# Crear directorios
RUN mkdir -p uploads logs public

# Exponer puerto
EXPOSE 3001

# Variables por defecto
ENV NODE_ENV=development
ENV PORT=3001

# Comando de inicio
CMD ["npm", "start"]