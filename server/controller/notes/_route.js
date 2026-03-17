const express = require('express');
const notes = express.Router();
const notesController = require('./notes');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all note routes
notes.use(authMiddleware);

// Routes
// Routes
const { uploadAny } = require('../../middleware/uploadMiddleware');

notes.post('/', notesController.createNote);
notes.post('/upload', uploadAny.array('files', 10), notesController.uploadAttachments); // Handle max 10 files
notes.get('/pinned', notesController.getPinnedNotes); // Must come before /:id
notes.get('/', notesController.getNotes);
notes.get('/:id', notesController.getNoteById);
notes.put('/:id', notesController.updateNote);
notes.delete('/:id', notesController.deleteNote);
notes.put('/:id/pin', notesController.pinNote);
notes.put('/:id/unpin', notesController.unpinNote);
notes.post('/:id/convert-to-task', notesController.convertToTask);

module.exports = notes;
