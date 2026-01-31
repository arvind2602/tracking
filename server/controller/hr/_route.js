const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const uploadMiddleware = require('../../middleware/uploadMiddleware');
const hrController = require('./hr');

// Document Template Routes
router.post('/templates', authMiddleware, hrController.createDocumentTemplate);
router.get('/templates', authMiddleware, hrController.getDocumentTemplates);
router.get('/templates/:id', authMiddleware, hrController.getDocumentTemplateById);
router.put('/templates/:id', authMiddleware, hrController.updateDocumentTemplate);
router.delete('/templates/:id', authMiddleware, hrController.deleteDocumentTemplate);
router.get('/templates/default/:type', authMiddleware, hrController.getDefaultTemplate);

// Generated Document Routes
router.post('/documents', authMiddleware, hrController.generateDocument);
router.get('/documents', authMiddleware, hrController.getGeneratedDocuments);
router.get('/documents/:id', authMiddleware, hrController.getGeneratedDocumentById);
router.put('/documents/:id', authMiddleware, hrController.updateGeneratedDocument);
router.post('/documents/:id/upload', authMiddleware, uploadMiddleware.single('file'), hrController.uploadDocumentFile);

// Statistics
router.get('/statistics', authMiddleware, hrController.getDocumentStatistics);

module.exports = router;