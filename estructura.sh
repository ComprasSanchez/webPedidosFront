#!/bin/bash

echo "🔧 Creando estructura de carpetas para WebPedidosSuc..."

mkdir -p src/assets
mkdir -p src/components/ui
mkdir -p src/context
mkdir -p src/data
mkdir -p src/features/login
mkdir -p src/features/buscador
mkdir -p src/features/carrito
mkdir -p src/features/historial
mkdir -p src/hooks
mkdir -p src/routes
mkdir -p src/services
mkdir -p src/utils
mkdir -p src/styles

# Archivos base
touch src/context/AuthContext.jsx
touch src/data/mockData.js
touch src/routes/AppRouter.jsx
touch src/styles/_variables.scss
touch src/styles/_mixins.scss
touch src/styles/_reset.scss
touch src/styles/main.scss
touch src/features/login/Login.jsx
touch src/features/login/Login.module.scss
touch src/features/buscador/BuscadorProductos.jsx
touch src/features/buscador/Buscador.module.scss
touch src/features/carrito/Carrito.jsx
touch src/features/carrito/Carrito.module.scss
touch src/features/historial/HistorialPedidos.jsx
touch src/features/historial/Historial.module.scss

echo "✅ Estructura creada. ¡A romperla!"
