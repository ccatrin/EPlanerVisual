const express = require('express');
const cors = require('cors');
require('dotenv').config();

const procedureRoutes = require('./routes/procedures');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Healthcheck
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'EPlanerVisual Backend API',
    version: '1.0.0',
    endpoints: {
      procedures: '/api/procedures'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Роуты процедур
app.use('/api/procedures', procedureRoutes);

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 API доступно по http://localhost:${PORT}/api/procedures`);
  console.log(`========================================`);
});

module.exports = app;
