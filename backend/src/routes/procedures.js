const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { convertToEPlaner } = require('../converter/eplanerConverter');

/**
 * GET /api/procedures
 * Получить список всех сохраненных процедур
 */
router.get('/', async (req, res) => {
  try {
    const parentId = req.query.parentId ? parseInt(req.query.parentId, 10) : undefined;
    
    const procedures = await prisma.procedure.findMany({
      where: parentId !== undefined ? { parent_id: parentId } : undefined,
      select: {
        id: true,
        name: true,
        parent_id: true,
        created_at: true,
        updated_at: true
      },
      orderBy: { updated_at: 'desc' }
    });

    res.json(procedures);
  } catch (err) {
    console.error('Ошибка при получении списка процедур:', err);
    res.status(500).json({ error: 'Не удалось получить список процедур' });
  }
});

/**
 * GET /api/procedures/:id
 * Получить конкретную процедуру по ID со всеми данными холста
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID процедуры' });
    }

    const procedure = await prisma.procedure.findUnique({
      where: { id },
      include: {
        sub_procedures: {
          select: { id: true, name: true, updated_at: true }
        }
      }
    });

    if (!procedure) {
      return res.status(404).json({ error: 'Процедура не найдена' });
    }

    // Парсим сохраненный JSON для удобства фронтенда
    let rawCanvas = null;
    let eplanerReady = null;

    try {
      rawCanvas = JSON.parse(procedure.raw_canvas_data);
    } catch {
      rawCanvas = procedure.raw_canvas_data;
    }

    try {
      if (procedure.eplaner_ready_data) {
        eplanerReady = JSON.parse(procedure.eplaner_ready_data);
      }
    } catch {
      eplanerReady = procedure.eplaner_ready_data;
    }

    res.json({
      id: procedure.id,
      name: procedure.name,
      parent_id: procedure.parent_id,
      raw_canvas_data: rawCanvas,
      eplaner_ready_data: eplanerReady,
      sub_procedures: procedure.sub_procedures,
      created_at: procedure.created_at,
      updated_at: procedure.updated_at
    });
  } catch (err) {
    console.error('Ошибка при загрузке процедуры:', err);
    res.status(500).json({ error: 'Не удалось загрузить процедуру' });
  }
});

/**
 * POST /api/procedures
 * Сохранить или обновить процедуру (включая автосохранение по дебаунсу)
 */
router.post('/', async (req, res) => {
  try {
    const { id, name, raw_canvas_data, parent_id } = req.body;

    if (!name && !id) {
      return res.status(400).json({ error: 'Имя процедуры обязательно' });
    }

    const rawDataString = typeof raw_canvas_data === 'object'
      ? JSON.stringify(raw_canvas_data)
      : (raw_canvas_data || '{"nodes":[],"edges":[]}');

    // Автоматически запускаем конвертер в формат EPlaner при сохранении
    const converted = convertToEPlaner(raw_canvas_data || {});
    const convertedString = JSON.stringify(converted);

    let savedProcedure;

    if (id) {
      const numericId = parseInt(id, 10);
      savedProcedure = await prisma.procedure.upsert({
        where: { id: numericId },
        update: {
          name: name || undefined,
          raw_canvas_data: rawDataString,
          eplaner_ready_data: convertedString,
          parent_id: parent_id ? parseInt(parent_id, 10) : undefined
        },
        create: {
          id: numericId,
          name: name || 'Без названия',
          raw_canvas_data: rawDataString,
          eplaner_ready_data: convertedString,
          parent_id: parent_id ? parseInt(parent_id, 10) : null
        }
      });
    } else {
      savedProcedure = await prisma.procedure.create({
        data: {
          name: name || 'Новая процедура',
          raw_canvas_data: rawDataString,
          eplaner_ready_data: convertedString,
          parent_id: parent_id ? parseInt(parent_id, 10) : null
        }
      });
    }

    res.status(201).json({
      message: 'Процедура успешно сохранена',
      procedure: {
        id: savedProcedure.id,
        name: savedProcedure.name,
        parent_id: savedProcedure.parent_id,
        updated_at: savedProcedure.updated_at,
        validation: converted.validation
      }
    });
  } catch (err) {
    console.error('Ошибка при сохранении процедуры:', err);
    res.status(500).json({ error: 'Не удалось сохранить процедуру' });
  }
});

/**
 * DELETE /api/procedures/:id
 * Удалить процедуру (с каскадным удалением под-схем)
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID процедуры' });
    }

    await prisma.procedure.delete({
      where: { id }
    });

    res.json({ message: 'Процедура успешно удалена' });
  } catch (err) {
    console.error('Ошибка при удалении процедуры:', err);
    res.status(500).json({ error: 'Не удалось удалить процедуру' });
  }
});

/**
 * GET /api/procedures/:id/export
 * Экспорт готового JSON-файла для промышленной системы EPlaner
 */
router.get('/:id/export', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID процедуры' });
    }

    const procedure = await prisma.procedure.findUnique({
      where: { id }
    });

    if (!procedure) {
      return res.status(404).json({ error: 'Процедура не найдена' });
    }

    let rawCanvas = {};
    try {
      rawCanvas = JSON.parse(procedure.raw_canvas_data);
    } catch {
      rawCanvas = {};
    }

    rawCanvas.procedureName = rawCanvas.procedureName || procedure.name;
    const eplanerData = convertToEPlaner(rawCanvas);

    // Если запрошено скачивание файла браузером
    const asFile = req.query.download === 'true';
    if (asFile) {
      const filename = `${procedure.name.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '_')}_eplaner.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      return res.send(JSON.stringify(eplanerData, null, 2));
    }

    res.json(eplanerData);
  } catch (err) {
    console.error('Ошибка при экспорте процедуры:', err);
    res.status(500).json({ error: 'Не удалось экспортировать процедуру' });
  }
});

module.exports = router;
